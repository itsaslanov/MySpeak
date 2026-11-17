"use client";

import { useEffect, useState, type FormEvent } from "react";

type Item = {
  id: number;
  name: string;
  createdAt: string;
};

export default function ItemList({
  initialItems,
}: {
  initialItems: Item[];
}) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [name, setName] = useState("");

  async function load() {
    const res = await fetch("/api/items");
    const data = await res.json();
    setItems(data);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createItem(e: FormEvent) {
    e.preventDefault();
    await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setName("");
    await load();
  }

  async function deleteItem(id: number) {
    await fetch(`/api/items/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <div>
      <form
        onSubmit={createItem}
        style={{ display: "flex", gap: "8px", marginBottom: "2rem" }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Item name"
        />
        <button type="submit">Add item</button>
      </form>

      <ul>
        {items.map((item) => (
          <li key={item.id}>
            {item.name}
            <button onClick={() => deleteItem(item.id)} style={{ marginLeft: "8px" }}>
              Delete
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
