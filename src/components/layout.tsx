import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/sidebar";

export default function Layout({ children }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="p-4 w-screen">
        {/* <SidebarTrigger  /> */}
        {children}
      </main>
    </SidebarProvider>
  );
}
