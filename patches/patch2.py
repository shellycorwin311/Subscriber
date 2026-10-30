import sys

def patch(path, old, new):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    count = content.count(old)
    if count != 1:
        print(f"SKIP {path}: found {count} matches (expected 1)")
        return
    content = content.replace(old, new, 1)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"OK {path}")

# 1. schema.prisma - add DayOfWeek enum
patch(
    "subscriber-hub/prisma/schema.prisma",
    '''enum DealerStatus {
  ACTIVE
  SUSPENDED
  CLOSED
}

enum RackDeliveryStatus {
  DELIVERED   // copies dropped, not yet reconciled
  RECONCILED  // dealer reported sold/returned, credit computed
}''',
    '''enum DealerStatus {
  ACTIVE
  SUSPENDED
  CLOSED
}

enum RackDeliveryStatus {
  DELIVERED   // copies dropped, not yet reconciled
  RECONCILED  // dealer reported sold/returned, credit computed
}

enum DayOfWeek {
  MON
  TUE
  WED
  THU
  FRI
  SAT
  SUN
}''',
)

# 2. schema.prisma - DealerStandingOrder gets dayOfWeek, unique on all three
patch(
    "subscriber-hub/prisma/schema.prisma",
    '''// Default quantity of a given paper a dealer receives each drop.
// Used as the starting point when creating a new RackDelivery.
model DealerStandingOrder {
  id       String  @id @default(cuid())
  dealerId String
  paperId  String
  quantity Int
  active   Boolean @default(true)

  dealer Dealer @relation(fields: [dealerId], references: [id])
  paper  Paper  @relation(fields: [paperId], references: [id])

  @@unique([dealerId, paperId])''',
    '''// Default quantity of a given paper a dealer receives on a given issue day
// (e.g. Daily Gazette Mon/Wed/Fri, Weekly Courier Wed only). One row per
// dealer+paper+day. Used as the starting point when creating a RackDelivery.
model DealerStandingOrder {
  id        String    @id @default(cuid())
  dealerId  String
  paperId   String
  dayOfWeek DayOfWeek
  quantity  Int
  active    Boolean   @default(true)

  dealer Dealer @relation(fields: [dealerId], references: [id])
  paper  Paper  @relation(fields: [paperId], references: [id])

  @@unique([dealerId, paperId, dayOfWeek])''',
)

# 3. dealers.ts - day-aware standing order route + delete route
patch(
    "subscriber-hub/src/routes/dealers.ts",
    '''const standingOrderSchema = z.object({
  paperId: z.string(),
  quantity: z.number().int().positive(),
});

// Staff: set (create or update) a dealer's standing order for a paper
dealersRouter.put("/:id/standing-orders", requireStaffAuth, async (req, res) => {
  const parsed = standingOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const order = await prisma.dealerStandingOrder.upsert({
    where: {
      dealerId_paperId: { dealerId: req.params.id, paperId: parsed.data.paperId },
    },
    update: { quantity: parsed.data.quantity, active: true },
    create: {
      dealerId: req.params.id,
      paperId: parsed.data.paperId,
      quantity: parsed.data.quantity,
    },
    include: { paper: true },
  });
  res.json(order);''',
    '''const standingOrderSchema = z.object({
  paperId: z.string(),
  dayOfWeek: z.enum(["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]),
  quantity: z.number().int().positive(),
});

// Staff: set (create or update) a dealer's standing order for a paper on a
// specific issue day - e.g. Daily Gazette on Monday, 15 copies.
dealersRouter.put("/:id/standing-orders", requireStaffAuth, async (req, res) => {
  const parsed = standingOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const order = await prisma.dealerStandingOrder.upsert({
    where: {
      dealerId_paperId_dayOfWeek: {
        dealerId: req.params.id,
        paperId: parsed.data.paperId,
        dayOfWeek: parsed.data.dayOfWeek,
      },
    },
    update: { quantity: parsed.data.quantity, active: true },
    create: {
      dealerId: req.params.id,
      paperId: parsed.data.paperId,
      dayOfWeek: parsed.data.dayOfWeek,
      quantity: parsed.data.quantity,
    },
    include: { paper: true },
  });
  res.json(order);
});

// Staff: remove a standing order day entirely (dealer no longer gets that
// paper on that day)
dealersRouter.delete("/standing-orders/:standingOrderId", requireStaffAuth, async (req, res) => {
  await prisma.dealerStandingOrder.delete({ where: { id: req.params.standingOrderId } });
  res.status(204).send();''',
)

# 4. seed.ts - day-aware standing order seeding
patch(
    "subscriber-hub/prisma/seed.ts",
    '''  await prisma.dealerStandingOrder.upsert({
    where: { dealerId_paperId: { dealerId: dealer.id, paperId: papers[0].id } },
    update: {},
    create: { dealerId: dealer.id, paperId: papers[0].id, quantity: 25 },
  });

  console.log("Seed complete.");
}''',
    '''  for (const day of ["MON", "WED", "FRI"] as const) {
    await prisma.dealerStandingOrder.upsert({
      where: {
        dealerId_paperId_dayOfWeek: { dealerId: dealer.id, paperId: papers[0].id, dayOfWeek: day },
      },
      update: {},
      create: { dealerId: dealer.id, paperId: papers[0].id, dayOfWeek: day, quantity: 25 },
    });
  }

  console.log("Seed complete.");
}''',
)

# 5. client.ts - DealerStandingOrder interface gets dayOfWeek
patch(
    "admin-dashboard/src/api/client.ts",
    '''export interface DealerStandingOrder {
  id: string;
  paperId: string;
  paper: Paper;
  quantity: number;
  active: boolean;
}''',
    '''export interface DealerStandingOrder {
  id: string;
  paperId: string;
  paper: Paper;
  dayOfWeek: "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";
  quantity: number;
  active: boolean;
}''',
)

# 6. client.ts - setStandingOrder takes dayOfWeek, add deleteStandingOrder
patch(
    "admin-dashboard/src/api/client.ts",
    '''export function setStandingOrder(dealerId: string, paperId: string, quantity: number) {
  return request<DealerStandingOrder>(`/api/dealers/${dealerId}/standing-orders`, {
    method: "PUT",
    body: JSON.stringify({ paperId, quantity }),
  });
}''',
    '''export function setStandingOrder(
  dealerId: string,
  paperId: string,
  dayOfWeek: DealerStandingOrder["dayOfWeek"],
  quantity: number
) {
  return request<DealerStandingOrder>(`/api/dealers/${dealerId}/standing-orders`, {
    method: "PUT",
    body: JSON.stringify({ paperId, dayOfWeek, quantity }),
  });
}

export function deleteStandingOrder(standingOrderId: string) {
  return request<void>(`/api/dealers/standing-orders/${standingOrderId}`, {
    method: "DELETE",
  });
}''',
)

# 7. DealerDetailPage.tsx - description text
patch(
    "admin-dashboard/src/pages/DealerDetailPage.tsx",
    '''        Default quantity dropped at each delivery, per paper.''',
    '''        Default quantity dropped per paper, per issue day (e.g. Daily Gazette Mon/Wed/Fri).''',
)

# 8. DealerDetailPage.tsx - replace StandingOrdersTable with day-aware version
patch(
    "admin-dashboard/src/pages/DealerDetailPage.tsx",
    '''function StandingOrdersTable({
  dealer,
  papers,
  onChanged,
  onError,
}: {
  dealer: api.Dealer;
  papers: api.Paper[];
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const [editingPaperId, setEditingPaperId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("");
  const [saving, setSaving] = useState(false);

  const orderByPaper = new Map(dealer.standingOrders.map((o) => [o.paperId, o]));

  async function handleSave(paperId: string) {
    const qty = parseInt(quantity, 10);
    if (!Number.isFinite(qty) || qty <= 0) {
      onError("Enter a quantity greater than zero.");
      return;
    }
    setSaving(true);
    try {
      await api.setStandingOrder(dealer.id, paperId, qty);
      setEditingPaperId(null);
      setQuantity("");
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't save the standing order");
    } finally {
      setSaving(false);
    }
  }

  return (
    <table style={{ marginBottom: 8 }}>
      <thead>
        <tr>
          <th>Paper</th>
          <th>Standing quantity</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {papers.map((paper) => {
          const order = orderByPaper.get(paper.id);
          const isEditing = editingPaperId === paper.id;
          return (
            <tr key={paper.id}>
              <td>{paper.name}</td>
              <td className="tabular">
                {isEditing ? (
                  <input
                    type="number"
                    min={1}
                    autoFocus
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    style={{ width: 90 }}
                  />
                ) : (
                  order?.quantity ?? "\u2014"
                )}
              </td>
              <td>
                {isEditing ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      className="btn btn-primary"
                      disabled={saving}
                      onClick={() => handleSave(paper.id)}
                    >
                      Save
                    </button>
                    <button className="btn btn-secondary" onClick={() => setEditingPaperId(null)}>
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    className="btn btn-secondary"
                    onClick={() => {
                      setEditingPaperId(paper.id);
                      setQuantity(String(order?.quantity ?? ""));
                    }}
                  >
                    {order ? "Edit" : "Set"}
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}''',
    '''const DAY_ORDER: api.DealerStandingOrder["dayOfWeek"][] = [
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
  "SUN",
];
const DAY_LABELS: Record<api.DealerStandingOrder["dayOfWeek"], string> = {
  MON: "Mon",
  TUE: "Tue",
  WED: "Wed",
  THU: "Thu",
  FRI: "Fri",
  SAT: "Sat",
  SUN: "Sun",
};

function StandingOrdersTable({
  dealer,
  papers,
  onChanged,
  onError,
}: {
  dealer: api.Dealer;
  papers: api.Paper[];
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState("");
  const [saving, setSaving] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const [addPaperId, setAddPaperId] = useState(papers[0]?.id ?? "");
  const [addDay, setAddDay] = useState<api.DealerStandingOrder["dayOfWeek"]>("MON");
  const [addQuantity, setAddQuantity] = useState("");
  const [adding, setAdding] = useState(false);

  const sortedOrders = [...dealer.standingOrders].sort((a, b) => {
    const paperCompare = a.paper.name.localeCompare(b.paper.name);
    if (paperCompare !== 0) return paperCompare;
    return DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek);
  });

  async function handleSaveEdit(order: api.DealerStandingOrder) {
    const qty = parseInt(quantity, 10);
    if (!Number.isFinite(qty) || qty <= 0) {
      onError("Enter a quantity greater than zero.");
      return;
    }
    setSaving(true);
    try {
      await api.setStandingOrder(dealer.id, order.paperId, order.dayOfWeek, qty);
      setEditingId(null);
      setQuantity("");
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't save the standing order");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(order: api.DealerStandingOrder) {
    setRemovingId(order.id);
    try {
      await api.deleteStandingOrder(order.id);
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't remove that standing order");
    } finally {
      setRemovingId(null);
    }
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault();
    const qty = parseInt(addQuantity, 10);
    if (!Number.isFinite(qty) || qty <= 0) {
      onError("Enter a quantity greater than zero.");
      return;
    }
    if (!addPaperId) return;
    setAdding(true);
    try {
      await api.setStandingOrder(dealer.id, addPaperId, addDay, qty);
      setAddQuantity("");
      onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't add that standing order");
    } finally {
      setAdding(false);
    }
  }

  const grouped = new Map<string, { paper: api.Paper; orders: api.DealerStandingOrder[] }>();
  for (const order of sortedOrders) {
    if (!grouped.has(order.paperId)) grouped.set(order.paperId, { paper: order.paper, orders: [] });
    grouped.get(order.paperId)!.orders.push(order);
  }
  const groupedRows = [...grouped.values()];

  const ghostBtn = {
    background: "none",
    border: "none",
    padding: 0,
    cursor: "pointer",
    fontSize: 12,
    textDecoration: "underline",
    color: "inherit",
  } as const;

  return (
    <>
      {groupedRows.length === 0 ? (
        <div className="empty-state">No standing orders set yet.</div>
      ) : (
        <table style={{ marginBottom: 16 }}>
          <thead>
            <tr>
              <th>Paper</th>
              <th>Issue days</th>
            </tr>
          </thead>
          <tbody>
            {groupedRows.map(({ paper, orders }) => (
              <tr key={paper.id}>
                <td style={{ whiteSpace: "nowrap" }}>{paper.name}</td>
                <td>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
                    {orders.map((order) => {
                      const isEditing = editingId === order.id;
                      return isEditing ? (
                        <span key={order.id} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 13 }}>{DAY_LABELS[order.dayOfWeek]}</span>
                          <input
                            type="number"
                            min={1}
                            autoFocus
                            value={quantity}
                            onChange={(e) => setQuantity(e.target.value)}
                            style={{ width: 70 }}
                          />
                          <button
                            className="btn btn-primary"
                            disabled={saving}
                            onClick={() => handleSaveEdit(order)}
                          >
                            Save
                          </button>
                          <button className="btn btn-secondary" onClick={() => setEditingId(null)}>
                            Cancel
                          </button>
                        </span>
                      ) : (
                        <span key={order.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 14 }}>
                          <span className="tabular">
                            {DAY_LABELS[order.dayOfWeek]} ({order.quantity})
                          </span>
                          <button
                            style={ghostBtn}
                            onClick={() => {
                              setEditingId(order.id);
                              setQuantity(String(order.quantity));
                            }}
                          >
                            Edit
                          </button>
                          <button
                            style={{ ...ghostBtn, color: "var(--status-canceled)" }}
                            disabled={removingId === order.id}
                            onClick={() => handleRemove(order)}
                          >
                            Remove
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <form
        onSubmit={handleAdd}
        style={{ display: "flex", gap: 12, alignItems: "flex-end", maxWidth: 560 }}
      >
        <div className="field" style={{ flex: 1 }}>
          <label>Paper</label>
          <select value={addPaperId} onChange={(e) => setAddPaperId(e.target.value)}>
            {papers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Issue day</label>
          <select
            value={addDay}
            onChange={(e) => setAddDay(e.target.value as api.DealerStandingOrder["dayOfWeek"])}
          >
            {DAY_ORDER.map((d) => (
              <option key={d} value={d}>
                {DAY_LABELS[d]}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label>Quantity</label>
          <input
            type="number"
            min={1}
            required
            value={addQuantity}
            onChange={(e) => setAddQuantity(e.target.value)}
            style={{ width: 90 }}
        />
      </div>
        <button className="btn btn-primary" type="submit" disabled={adding}>
          {adding ? "Adding\u2026" : "Add"}
        </button>
      </form>
    </>
  );
}''',
)

print("DONE")
