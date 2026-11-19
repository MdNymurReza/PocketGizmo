import { SiteHeader } from "@/components/shop/site-header";
import { SiteFooter } from "@/components/shop/site-footer";
import { ChatButton } from "@/components/shop/chat-button";
import { getStoreSettings } from "@/lib/store-settings";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const store = await getStoreSettings();
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only z-50 rounded-md bg-ink px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
      <ChatButton whatsapp={store.whatsappLink} messenger={store.messengerLink} />
    </div>
  );
}
