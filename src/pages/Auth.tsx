import { Navigate } from "react-router-dom";

// Giriş/kayıt UI şimdilik gizlendi. Route çalışır kalsın diye dosya duruyor,
// ancak sayfaya gelen kullanıcı doğrudan ana sayfaya yönlendirilir.
// İleride tekrar açmak için bu dosyayı git geçmişinden geri yükle.
export default function Auth() {
  return <Navigate to="/" replace />;
}
