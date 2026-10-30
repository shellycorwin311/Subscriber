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

# 1. schema.prisma - add dealerNumber field
patch(
    "subscriber-hub/prisma/schema.prisma",
    '''model Dealer {
  id          String       @id @default(cuid())
  name        String       // business name
  contactName String?
  phone       String?
  email       String?
  addressLine1 String?
  addressLine2 String?
  city         String?
  state        String?
  zip          String?
  status       DealerStatus @default(ACTIVE)
  creditTerms  String?      // free-text, e.g. "Net 30", "Credit at next delivery"''',
    '''model Dealer {
  id          String       @id @default(cuid())
  dealerNumber String?     @unique // human-facing account number, e.g. "D-1001"
  name        String       // business name
  contactName String?
  phone       String?
  email       String?
  addressLine1 String?
  addressLine2 String?
  city         String?
  state        String?
  zip          String?
  status       DealerStatus @default(ACTIVE)
  creditTerms  String?      // free-text, e.g. "Net 30", "Credit at next delivery"''',
)

# 2. dealers.ts - createDealerSchema accepts dealerNumber
patch(
    "subscriber-hub/src/routes/dealers.ts",
    '''const createDealerSchema = z.object({
  name: z.string().min(1),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  addressLine1: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  creditTerms: z.string().optional(),
});''',
    '''const createDealerSchema = z.object({
  dealerNumber: z.string().optional(),
  name: z.string().min(1),
  contactName: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  addressLine1: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zip: z.string().optional(),
  creditTerms: z.string().optional(),
});''',
)

# 3. dealers.ts - search matches dealerNumber too
patch(
    "subscriber-hub/src/routes/dealers.ts",
    '''// Staff: search dealers by name or zip
dealersRouter.get("/", requireStaffAuth, async (req, res) => {
  const q = (req.query.q as string) || "";
  const dealers = await prisma.dealer.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { zip: { contains: q } },
          ],
        }
      : undefined,
    include: { standingOrders: { include: { paper: true } } },
    orderBy: { name: "asc" },
  });
  res.json(dealers);
});''',
    '''// Staff: search dealers by name, dealer number, or zip
dealersRouter.get("/", requireStaffAuth, async (req, res) => {
  const q = (req.query.q as string) || "";
  const dealers = await prisma.dealer.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { dealerNumber: { contains: q, mode: "insensitive" } },
            { zip: { contains: q } },
          ],
        }
      : undefined,
    include: { standingOrders: { include: { paper: true } } },
    orderBy: { name: "asc" },
  });
  res.json(dealers);
});''',
)

# 4. client.ts - Dealer interface
patch(
    "admin-dashboard/src/api/client.ts",
    '''export interface Dealer {
  id: string;
  name: string;''',
    '''export interface Dealer {
  id: string;
  dealerNumber?: string | null;
  name: string;''',
)

# 5. client.ts - createDealer signature
patch(
    "admin-dashboard/src/api/client.ts",
    '''export function createDealer(data: {
  name: string;''',
    '''export function createDealer(data: {
  dealerNumber?: string;
  name: string;''',
)

# 6. DealersPage.tsx - table header + row
patch(
    "admin-dashboard/src/pages/DealersPage.tsx",
    '''          <thead>
            <tr>
              <th>Name</th>
              <th>City</th>
              <th>Papers</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {dealers.map((d) => (
              <tr key={d.id} className="clickable" onClick={() => navigate(`/dealers/${d.id}`)}>
                <td>{d.name}</td>''',
    '''          <thead>
            <tr>
              <th>Dealer #</th>
              <th>Name</th>
              <th>City</th>
              <th>Papers</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {dealers.map((d) => (
              <tr key={d.id} className="clickable" onClick={() => navigate(`/dealers/${d.id}`)}>
                <td className="tabular">{d.dealerNumber ?? "\u2014"}</td>
                <td>{d.name}</td>''',
)

# 7. DealersPage.tsx - AddDealerForm state
patch(
    "admin-dashboard/src/pages/DealersPage.tsx",
    '''function AddDealerForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");''',
    '''function AddDealerForm({ onCreated }: { onCreated: () => void }) {
  const [dealerNumber, setDealerNumber] = useState("");
  const [name, setName] = useState("");''',
)

# 8. DealersPage.tsx - createDealer call
patch(
    "admin-dashboard/src/pages/DealersPage.tsx",
    '''      await api.createDealer({ name, contactName, addressLine1, city, state, zip, creditTerms });''',
    '''      await api.createDealer({ dealerNumber, name, contactName, addressLine1, city, state, zip, creditTerms });''',
)

# 9. DealersPage.tsx - form UI field
patch(
    "admin-dashboard/src/pages/DealersPage.tsx",
    '''      <h3>New dealer</h3>
      {error && <div className="error-banner">{error}</div>}
      <div className="field">
        <label>Business name</label>''',
    '''      <h3>New dealer</h3>
      {error && <div className="error-banner">{error}</div>}
      <div className="field">
        <label>Dealer number</label>
        <input
          placeholder="e.g. D-1001"
          value={dealerNumber}
          onChange={(e) => setDealerNumber(e.target.value)}
        />
      </div>
      <div className="field">
        <label>Business name</label>''',
)

# 10. DealerDetailPage.tsx - header state + editable dealer number in contact card
patch(
    "admin-dashboard/src/pages/DealerDetailPage.tsx",
    '''export function DealerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [dealer, setDealer] = useState<api.Dealer | null>(null);
  const [papers, setPapers] = useState<api.Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    load(id);
  }, [id]);

  async function load(dealerId: string) {
    setLoading(true);
    setError(null);
    try {
      const [d, p] = await Promise.all([api.fetchDealer(dealerId), api.fetchPapers()]);
      setDealer(d);
      setPapers(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load this dealer");
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    if (id) await load(id);
  }

  if (loading) return <p style={{ color: "var(--ink-soft)" }}>Loading\u2026</p>;
  if (error) return <div className="error-banner">{error}</div>;
  if (!dealer) return null;

  return (
    <div>
      <Link to="/dealers" style={{ fontSize: 13 }}>
        \u2190 Back to dealers
      </Link>

      <div className="page-header" style={{ marginTop: 12 }}>
        <h1>{dealer.name}</h1>
      </div>

      {actionError && <div className="error-banner">{actionError}</div>}

      <div className="card" style={{ marginBottom: 24, maxWidth: 480 }}>
        <h3>Contact & address</h3>
        <p style={{ margin: "4px 0", fontSize: 14 }}>{dealer.contactName ?? "No contact listed"}</p>
        <p style={{ margin: "4px 0", fontSize: 14, color: "var(--ink-soft)" }}>
          {dealer.addressLine1 ?? "\u2014"}
          {dealer.city ? `, ${dealer.city}` : ""} {dealer.state ?? ""} {dealer.zip ?? ""}
        </p>
        <p style={{ margin: "4px 0", fontSize: 14, color: "var(--ink-soft)" }}>
          Credit terms: {dealer.creditTerms ?? "Not set"}
        </p>
      </div>''',
    '''export function DealerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [dealer, setDealer] = useState<api.Dealer | null>(null);
  const [papers, setPapers] = useState<api.Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingNumber, setEditingNumber] = useState(false);
  const [numberDraft, setNumberDraft] = useState("");
  const [savingNumber, setSavingNumber] = useState(false);

  useEffect(() => {
    if (!id) return;
    load(id);
  }, [id]);

  async function load(dealerId: string) {
    setLoading(true);
    setError(null);
    try {
      const [d, p] = await Promise.all([api.fetchDealer(dealerId), api.fetchPapers()]);
      setDealer(d);
      setPapers(p);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load this dealer");
    } finally {
      setLoading(false);
    }
  }

  async function refresh() {
    if (id) await load(id);
  }

  async function handleSaveNumber() {
    if (!dealer) return;
    setSavingNumber(true);
    try {
      const updated = await api.updateDealer(dealer.id, { dealerNumber: numberDraft || null });
      setDealer(updated);
      setEditingNumber(false);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Couldn't save the dealer number");
    } finally {
      setSavingNumber(false);
    }
  }

  if (loading) return <p style={{ color: "var(--ink-soft)" }}>Loading\u2026</p>;
  if (error) return <div className="error-banner">{error}</div>;
  if (!dealer) return null;

  return (
    <div>
      <Link to="/dealers" style={{ fontSize: 13 }}>
        \u2190 Back to dealers
      </Link>

      <div className="page-header" style={{ marginTop: 12 }}>
        <h1>{dealer.name}</h1>
      </div>

      {actionError && <div className="error-banner">{actionError}</div>}

      <div className="card" style={{ marginBottom: 24, maxWidth: 480 }}>
        <h3>Contact & address</h3>
        <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0" }}>
          <span style={{ fontSize: 14, color: "var(--ink-soft)" }}>Dealer #:</span>
          {editingNumber ? (
            <>
              <input
                autoFocus
                value={numberDraft}
                onChange={(e) => setNumberDraft(e.target.value)}
                style={{ width: 140 }}
              />
              <button className="btn btn-primary" disabled={savingNumber} onClick={handleSaveNumber}>
                Save
              </button>
              <button className="btn btn-secondary" onClick={() => setEditingNumber(false)}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <span style={{ fontSize: 14 }} className="tabular">
                {dealer.dealerNumber ?? "Not set"}
              </span>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setNumberDraft(dealer.dealerNumber ?? "");
                  setEditingNumber(true);
                }}
              >
                {dealer.dealerNumber ? "Edit" : "Set"}
              </button>
            </>
          )}
        </div>
        <p style={{ margin: "4px 0", fontSize: 14 }}>{dealer.contactName ?? "No contact listed"}</p>
        <p style={{ margin: "4px 0", fontSize: 14, color: "var(--ink-soft)" }}>
          {dealer.addressLine1 ?? "\u2014"}
          {dealer.city ? `, ${dealer.city}` : ""} {dealer.state ?? ""} {dealer.zip ?? ""}
        </p>
        <p style={{ margin: "4px 0", fontSize: 14, color: "var(--ink-soft)" }}>
          Credit terms: {dealer.creditTerms ?? "Not set"}
        </p>
      </div>''',
)

print("DONE")
