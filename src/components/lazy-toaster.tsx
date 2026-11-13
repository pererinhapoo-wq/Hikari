import { Toaster, type ToasterProps } from "sonner";
import "@/styles/sonner.css";

export default function LazyToaster(props: ToasterProps) {
  return <Toaster {...props} />;
}
