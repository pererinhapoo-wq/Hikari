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

      // 1. Restaura os estilos inline originais do body e html
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
      window.scrollTo(0, targetScroll);

      // 3. Reforço no frame seguinte caso o navegador tente reiniciar o scroll durante o reflow
      requestAnimationFrame(() => {
        window.scrollTo(0, targetScroll);
      });
    }
  };
}

/**
 * Retorna o número de bloqueios atualmente ativos.
 */
export function getActiveScrollLockCount(): number {
  return activeLocks.size;
}

/**
 * Retorna true se a rolagem estiver atualmente travada por algum modal.
 */
export function isScrollLocked(): boolean {
  return activeLocks.size > 0;
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
