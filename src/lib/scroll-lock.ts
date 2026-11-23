import { useEffect } from "react";

/**
 * =========================================================
 * GERENCIADOR CENTRALIZADO DE SCROLL LOCK (HIKARI)
 * =========================================================
 * - Singleton com contagem de referências por Token/Set
 * - Técnica "position: fixed" no body (padrão ouro para iOS Safari)
 * - Captura e restauração exata de window.scrollY
 * - Compensação dinâmica da largura da barra de rolagem (evita layout shift no desktop)
 * - Restauração segura dos estilos inline originais
 * - Compatível com SSR, React StrictMode e modais simultâneos
 */

interface SavedDocumentStyles {
  bodyPosition: string;
  bodyTop: string;
  bodyLeft: string;
  bodyRight: string;
  bodyWidth: string;
  bodyOverflow: string;
  bodyPaddingRight: string;
  htmlOverflow: string;
  htmlScrollBehavior: string;
}

// Estado singleton
const activeLocks = new Set<symbol>();
let savedScrollY = 0;
let savedStyles: SavedDocumentStyles | null = null;

/**
 * Adquire um bloqueio de rolagem.
 * Retorna uma função de liberação idempotente associada a este bloqueio específico.
 */
export function acquireScrollLock(): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }

  const lockId = Symbol("hikari-scroll-lock");

  // Se este é o primeiro bloqueio ativo, trava a rolagem da página
  if (activeLocks.size === 0) {
    const docEl = document.documentElement;
    const body = document.body;

    // 1. Captura a posição exata de rolagem antes de qualquer alteração
    const currentScrollY =
      window.scrollY || window.pageYOffset || docEl.scrollTop || body.scrollTop || 0;
    savedScrollY = currentScrollY;

    // 2. Calcula a largura da barra de rolagem no desktop para evitar salto visual
    const scrollbarWidth = window.innerWidth - docEl.clientWidth;

    // 3. Salva os estilos inline originais
    savedStyles = {
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
      bodyOverflow: body.style.overflow,
      bodyPaddingRight: body.style.paddingRight,
      htmlOverflow: docEl.style.overflow,
      htmlScrollBehavior: docEl.style.scrollBehavior,
    };

    // 4. Desabilita temporariamente smooth scrolling para restaurações instantâneas
    docEl.style.scrollBehavior = "auto";

    // 5. Aplica a técnica position: fixed compatível com iOS Safari e navegadores desktop
    body.style.position = "fixed";
    body.style.top = `-${currentScrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";

    // Compensação da barra de rolagem apenas se houver scrollbar visível no momento
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }
  }

  activeLocks.add(lockId);

  // Função de liberação segura e idempotente para este lockId
  let released = false;
  return () => {
    if (released) return;
    released = true;

    if (!activeLocks.has(lockId)) {
      return;
    }

    activeLocks.delete(lockId);

    // Quando todos os modais forem fechados, restaura a página
    if (activeLocks.size === 0 && savedStyles) {
      const docEl = document.documentElement;
      const body = document.body;
      const targetScroll = savedScrollY;
      const stylesToRestore = savedStyles;

      // Limpa os estados salvos antes de restaurar o DOM
      savedStyles = null;
      savedScrollY = 0;

      // 1. Restaura os estilos inline originais do body e html antes de mover o scroll
      body.style.position = stylesToRestore.bodyPosition;
      body.style.top = stylesToRestore.bodyTop;
      body.style.left = stylesToRestore.bodyLeft;
      body.style.right = stylesToRestore.bodyRight;
      body.style.width = stylesToRestore.bodyWidth;
      body.style.overflow = stylesToRestore.bodyOverflow;
      body.style.paddingRight = stylesToRestore.bodyPaddingRight;
      docEl.style.overflow = stylesToRestore.htmlOverflow;
      docEl.style.scrollBehavior = stylesToRestore.htmlScrollBehavior;

      // 2. Restaura imediatamente a posição de rolagem original sem animação
      window.scrollTo({
        top: targetScroll,
        left: 0,
        behavior: "instant",
      });

      // 3. Reforço duplo em rAF para garantir estabilidade em mobile e desktop durante o reflow do DOM
      requestAnimationFrame(() => {
        window.scrollTo({
          top: targetScroll,
          left: 0,
          behavior: "instant",
        });
        requestAnimationFrame(() => {
          window.scrollTo({
            top: targetScroll,
            left: 0,
            behavior: "instant",
          });
        });
      });
    }
  };
}

// Estado singleton para dropdowns (sem position: fixed no body para não deslocar menus ancorados)
const activeDropdownLocks = new Set<symbol>();
let savedDropdownStyles: {
  htmlOverflow: string;
  htmlOverscrollBehavior: string;
  htmlTouchAction: string;
  bodyOverscrollBehavior: string;
  bodyTouchAction: string;
  bodyPaddingRight: string;
} | null = null;
let dropdownListenersCleanup: (() => void) | null = null;

const DROPDOWN_SCROLL_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "PageUp",
  "PageDown",
  "Home",
  "End",
  " ",
  "Spacebar",
]);

function isEditableElement(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  return (target as HTMLElement).isContentEditable;
}

function isButtonLikeElement(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return Boolean(target.closest("button, [role='button']"));
}

/**
 * Adquire um bloqueio de rolagem específico para menus contextuais/dropdowns fixos.
 * Mantém window.scrollY intacto (sem position: fixed no body) e bloqueia
 * rolagem por toque (Android/iOS), wheel/trackpad e teclas de rolagem.
 */
export function acquireDropdownScrollLock(): () => void {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return () => {};
  }

  const lockId = Symbol("hikari-dropdown-scroll-lock");

  if (activeDropdownLocks.size === 0) {
    const docEl = document.documentElement;
    const body = document.body;

    const lockedScrollX = window.scrollX || window.pageXOffset || docEl.scrollLeft || 0;
    const lockedScrollY = window.scrollY || window.pageYOffset || docEl.scrollTop || 0;
    const scrollbarWidth = window.innerWidth - docEl.clientWidth;

    savedDropdownStyles = {
      htmlOverflow: docEl.style.overflow,
      htmlOverscrollBehavior: docEl.style.overscrollBehavior,
      htmlTouchAction: docEl.style.touchAction,
      bodyOverscrollBehavior: body.style.overscrollBehavior,
      bodyTouchAction: body.style.touchAction,
      bodyPaddingRight: body.style.paddingRight,
    };

    // Apenas html recebe overflow: hidden; manter body com overflow original evita que
    // body vire um scroll container independente e desloque <header class="sticky top-0">.
    docEl.style.overflow = "hidden";
    docEl.style.overscrollBehavior = "none";
    docEl.style.touchAction = "none";
    body.style.overscrollBehavior = "none";
    body.style.touchAction = "none";

    if (scrollbarWidth > 0) {
      const currentPaddingRight = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0;
      body.style.paddingRight = `${currentPaddingRight + scrollbarWidth}px`;
    }

    const handleWheel = (event: WheelEvent) => {
      if (event.cancelable) {
        event.preventDefault();
      }
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (event.cancelable) {
        event.preventDefault();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!DROPDOWN_SCROLL_KEYS.has(event.key)) return;
      if (isEditableElement(event.target)) return;
      if ((event.key === " " || event.key === "Spacebar") && isButtonLikeElement(event.target)) {
        return;
      }
      if (event.cancelable) {
        event.preventDefault();
      }
    };

    const handleScroll = () => {
      if (window.scrollY !== lockedScrollY || window.scrollX !== lockedScrollX) {
        window.scrollTo({
          top: lockedScrollY,
          left: lockedScrollX,
          behavior: "instant",
        });
      }
    };

    document.addEventListener("touchmove", handleTouchMove, { passive: false, capture: true });
    window.addEventListener("wheel", handleWheel, { passive: false, capture: true });
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("scroll", handleScroll, { passive: true });

    dropdownListenersCleanup = () => {
      document.removeEventListener("touchmove", handleTouchMove, { capture: true });
      window.removeEventListener("wheel", handleWheel, { capture: true });
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
      window.removeEventListener("scroll", handleScroll);
    };
  }

  activeDropdownLocks.add(lockId);

  let released = false;
  return () => {
    if (released) return;
    released = true;

    if (!activeDropdownLocks.has(lockId)) {
      return;
    }

    activeDropdownLocks.delete(lockId);

    if (activeDropdownLocks.size === 0) {
      dropdownListenersCleanup?.();
      dropdownListenersCleanup = null;

      if (savedDropdownStyles) {
        const docEl = document.documentElement;
        const body = document.body;
        const stylesToRestore = savedDropdownStyles;
        savedDropdownStyles = null;

        docEl.style.overflow = stylesToRestore.htmlOverflow;
        docEl.style.overscrollBehavior = stylesToRestore.htmlOverscrollBehavior;
        docEl.style.touchAction = stylesToRestore.htmlTouchAction;
        body.style.overscrollBehavior = stylesToRestore.bodyOverscrollBehavior;
        body.style.touchAction = stylesToRestore.bodyTouchAction;
        body.style.paddingRight = stylesToRestore.bodyPaddingRight;
      }
    }
  };
}

/**
 * Retorna o número de bloqueios atualmente ativos.
 */
export function getActiveScrollLockCount(): number {
  return activeLocks.size + activeDropdownLocks.size;
}

/**
 * Retorna true se a rolagem estiver atualmente travada por algum modal ou dropdown.
 */
export function isScrollLocked(): boolean {
  return activeLocks.size > 0 || activeDropdownLocks.size > 0;
}

/**
 * Hook React para gerenciar o bloqueio de rolagem de um modal/drawer.
 * - Adquire o lock quando `isOpen` for true.
 * - Libera o lock no cleanup ou quando `isOpen` for false.
 * - Suporta React StrictMode, desmontagens seguras e múltiplos modais.
 */
export function useScrollLock(isOpen: boolean = true): void {
  useEffect(() => {
    if (!isOpen || typeof window === "undefined") {
      return;
    }

    const release = acquireScrollLock();
    return () => {
      release();
    };
  }, [isOpen]);
}

/**
 * Hook React para bloquear a rolagem de fundo enquanto um menu dropdown estiver aberto.
 */
export function useDropdownScrollLock(isOpen: boolean = false): void {
  useEffect(() => {
    if (!isOpen || typeof window === "undefined") {
      return;
    }

    const release = acquireDropdownScrollLock();
    return () => {
      release();
    };
  }, [isOpen]);
}
