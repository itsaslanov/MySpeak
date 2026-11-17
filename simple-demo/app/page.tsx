import { prisma } from "@/lib/prisma";
import ItemList from "./item-list";

export default async function Home() {
  const items = await prisma.item.findMany();

  const initialItems = items.map((item) => ({
    id: item.id,
    name: item.name,
    createdAt: item.createdAt.toISOString(),
  }));

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>Simple Demo</h1>
      <ItemList initialItems={initialItems} />
    </main>
  );
}
