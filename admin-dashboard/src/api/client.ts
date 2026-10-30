const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function getToken(): string | null {
  return localStorage.getItem("staffToken");
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.error?.toString() || `Request failed (${res.status})`, res.status);
  }

  const contentType = res.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return res.json();
  }
  return res.text() as unknown as T;
}

// --- Types ---

export interface Paper {
  id: string;
  name: string;
  slug: string;
}

export interface Subscription {
  id: string;
  paperId: string;
  paper: Paper;
  type: "PRINT" | "DIGITAL" | "PRINT_DIGITAL";
  tier: string;
  status: "PENDING" | "ACTIVE" | "PAUSED" | "LAPSED" | "CANCELED";
  startDate: string;
  renewalDate: string;
}

export interface Subscriber {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  billingAddressLine1?: string | null;
  billingCity?: string | null;
  billingState?: string | null;
  billingZip?: string | null;
  deliveryAddressLine1?: string | null;
  deliveryCity?: string | null;
  deliveryState?: string | null;
  deliveryZip?: string | null;
  subscriptions: Subscription[];
}

export interface Payment {
  id: string;
  amountCents: number;
  status: "SUCCEEDED" | "FAILED" | "REFUNDED" | "PENDING";
  processedAt: string | null;
  createdAt: string;
}

export interface CirculationRow {
  paper: string;
  print: number;
  digital: number;
  printAndDigital: number;
  total: number;
}

export interface StaffAccount {
  id: string;
  email: string;
  role: "ADMIN" | "CUSTOMER_SERVICE" | "CIRCULATION";
  createdAt: string;
}

export interface DealerStandingOrder {
  id: string;
  paperId: string;
  paper: Paper;
  dayOfWeek: "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT" | "SUN";
  quantity: number;
  active: boolean;
}

export interface RackDelivery {
  id: string;
  paperId: string;
  paper: Paper;
  deliveryDate: string;
  quantityDelivered: number;
  quantitySold: number | null;
  quantityReturned: number | null;
  creditCents: number | null;
  status: "DELIVERED" | "RECONCILED";
}

export interface DealerPricing {
  id: string;
  dealerId: string | null;
  paperId: string;
  paper: Paper;
  dayOfWeek: DealerStandingOrder["dayOfWeek"];
  priceCents: number;
  effectiveDate: string;
}

export interface DealerPayment {
  id: string;
  dealerId: string;
  paymentDate: string;
  amountCents: number;
  referenceNumber: string | null;
  paymentMethod: "CHECK" | "CARD" | "ACH";
}

export interface DriverPayPeriod {
  id: string;
  truckId: string;
  periodStart: string;
  periodEnd: string;
  dropCount: number;
  dropPayCents: number;
  fuelMileageCents: number;
  postOfficeDropsCents: number;
  advertisingDeliveryCents: number;
  totalCents: number;
  status: "OPEN" | "INVOICED" | "PAID";
}

export interface Truck {
  id: string;
  truckNumber: string;
  driverName: string | null;
  phone: string | null;
  active: boolean;
  driverType: "EMPLOYEE" | "CONTRACTOR";
  addressLine1: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  payPerDropCents: number | null;
  payPeriods?: DriverPayPeriod[];
}

export interface RackRouteStop {
  id: string;
  dealerId: string;
  dealer: Dealer;
  sequence: number;
}

export interface RackRoute {
  id: string;
  paperId: string;
  name: string;
  truckId: string | null;
  truck: Truck | null;
  stops: RackRouteStop[];
}

export interface Dealer {
  id: string;
  dealerNumber?: string | null;
  name: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  status: "ACTIVE" | "SUSPENDED" | "CLOSED";
  creditTerms?: string | null;
  standingOrders: DealerStandingOrder[];
  deliveries?: RackDelivery[];
  dealerType: "DEALER" | "VENDING" | "SERVICE";
  pricing?: DealerPricing[];
  payments?: DealerPayment[];
}

export interface RackSalesRow {
  paper: string;
  delivered: number;
  sold: number;
  returned: number;
  creditIssued: number;
  sellThroughRate: number;
}

export interface PressRun {
  id: string;
  paperId: string;
  paper: Paper;
  runDate: string;
  bundleSize: number;
}

export interface PressOrder {
  paper: { id: string; name: string };
  runDate: string;
  dealer: number;
  vending: number;
  serviceCopies: number;
  mail: number;
  printSubtotal: number;
  internetSubscribers: number;
}

export interface StatementLine {
  date: string;
  dayOfWeek: string;
  quantity: number;
  priceCents: number;
}

export interface StatementPaymentLine {
  date: string;
  amountCents: number;
  referenceNumber: string | null;
}

export interface StatementWeek {
  weekEnding: string;
  charges: StatementLine[];
  returns: StatementLine[];
  payments: StatementPaymentLine[];
}

export interface Statement {
  dealer: { id: string; name: string; dealerNumber: string | null };
  paper: { id: string; name: string };
  month: string;
  weeks: StatementWeek[];
  totalChargesCents: number;
  totalReturnsCents: number;
  totalPaymentsCents: number;
  netOwedCents: number;
}

export interface BatchStatements {
  month: string;
  statements: Statement[];
}

// --- Auth ---

export function login(email: string, password: string) {
  return request<{ token: string; staff: StaffAccount }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function fetchMe() {
  return request<StaffAccount>("/api/auth/me");
}

export function changePassword(currentPassword: string, newPassword: string) {
  return request<{ success: boolean }>("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export function createStaffAccount(data: {
  email: string;
  password: string;
  role: StaffAccount["role"];
}) {
  return request<StaffAccount>("/api/auth/staff", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// --- Subscribers ---

export function searchSubscribers(query: string, page = 1) {
  const params = new URLSearchParams({ q: query, page: String(page) });
  return request<Subscriber[]>(`/api/subscribers?${params.toString()}`);
}

export function fetchSubscriber(id: string) {
  return request<Subscriber>(`/api/subscribers/${id}`);
}

export function updateSubscriber(id: string, data: Partial<Subscriber>) {
  return request<Subscriber>(`/api/subscribers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function fetchPaymentHistory(subscriberId: string) {
  return request<Payment[]>(`/api/payments/subscriber/${subscriberId}`);
}

// --- Subscriptions ---

export function pauseSubscription(id: string) {
  return request<Subscription>(`/api/subscriptions/${id}/pause`, { method: "POST" });
}

export function resumeSubscription(id: string) {
  return request<Subscription>(`/api/subscriptions/${id}/resume`, { method: "POST" });
}

export function cancelSubscription(id: string) {
  return request<Subscription>(`/api/subscriptions/${id}/cancel`, { method: "POST" });
}

// --- Papers ---

export function fetchPapers() {
  return request<Paper[]>("/api/papers");
}

// --- Delivery routes ---

export function exportRouteCsv(paperId: string) {
  return request<string>(`/api/delivery-routes/${paperId}/export`);
}

// --- Reports ---

export function fetchCirculationReport() {
  return request<CirculationRow[]>("/api/reports/circulation");
}

export function fetchRevenueReport(from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return request<{ totalRevenue: number; paymentCount: number }>(
    `/api/reports/revenue?${params.toString()}`
  );
}

export function fetchChurnReport(from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return request<{ canceledCount: number }>(`/api/reports/churn?${params.toString()}`);
}

export function fetchRackSalesReport(from?: string, to?: string) {
  const params = new URLSearchParams();
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  return request<{ results: RackSalesRow[] }>(`/api/reports/rack-sales?${params.toString()}`);
}

// --- Dealers ---

export function createDealer(data: {
  dealerNumber?: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  zip?: string;
  creditTerms?: string;
  dealerType?: "DEALER" | "VENDING" | "SERVICE";
}) {
  return request<Dealer>("/api/dealers", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function searchDealers(query: string) {
  const params = new URLSearchParams({ q: query });
  return request<Dealer[]>(`/api/dealers?${params.toString()}`);
}

export function fetchDealer(id: string) {
  return request<Dealer>(`/api/dealers/${id}`);
}

export function updateDealer(id: string, data: Partial<Dealer>) {
  return request<Dealer>(`/api/dealers/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function setStandingOrder(
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
}

export function recordDelivery(
  dealerId: string,
  data: { paperId: string; deliveryDate: string; quantityDelivered: number }
) {
  return request<RackDelivery>(`/api/dealers/${dealerId}/deliveries`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function reconcileDelivery(
  deliveryId: string,
  data: { quantitySold: number; quantityReturned: number }
) {
  return request<RackDelivery>(`/api/dealers/deliveries/${deliveryId}/reconcile`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function fetchDeliveryByDate(dealerId: string, paperId: string, date: string) {
  const params = new URLSearchParams({ paperId, date });
  return request<RackDelivery>(`/api/dealers/${dealerId}/deliveries/by-date?${params.toString()}`);
}

// --- Dealer pricing ---

export function setDealerPricing(
  dealerId: string,
  data: { paperId: string; dayOfWeek: DealerStandingOrder["dayOfWeek"]; priceCents: number }
) {
  return request<DealerPricing>(`/api/dealers/${dealerId}/pricing`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteDealerPricing(pricingId: string) {
  return request<void>(`/api/dealers/pricing/${pricingId}`, { method: "DELETE" });
}

// --- Dealer payments ---

export function recordPayment(
  dealerId: string,
  data: { paymentDate: string; amountCents: number; referenceNumber?: string; paymentMethod?: "CHECK" | "CARD" | "ACH" }
) {
  return request<DealerPayment>(`/api/dealers/${dealerId}/payments`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// --- Trucks ---

export function fetchTrucks() {
  return request<Truck[]>("/api/trucks");
}

export function fetchTruck(id: string) {
  return request<Truck>(`/api/trucks/${id}`);
}

export function createTruck(data: {
  truckNumber: string;
  driverName?: string;
  phone?: string;
  driverType?: "EMPLOYEE" | "CONTRACTOR";
  addressLine1?: string;
  city?: string;
  state?: string;
  zip?: string;
  payPerDropCents?: number;
}) {
  return request<Truck>("/api/trucks", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateTruck(id: string, data: Partial<Truck>) {
  return request<Truck>(`/api/trucks/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export function generatePayPeriod(
  truckId: string,
  data: {
    periodStart: string;
    periodEnd: string;
    fuelMileageCents?: number;
    postOfficeDropsCents?: number;
    advertisingDeliveryCents?: number;
  }
) {
  return request<DriverPayPeriod>(`/api/trucks/${truckId}/pay-periods`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updatePayPeriodStatus(payPeriodId: string, status: "OPEN" | "INVOICED" | "PAID") {
  return request<DriverPayPeriod>(`/api/trucks/pay-periods/${payPeriodId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

// --- Rack routes ---

export function fetchRackRoutes(paperId?: string) {
  const params = paperId ? `?paperId=${paperId}` : "";
  return request<RackRoute[]>(`/api/rack-routes${params}`);
}

export function createRackRoute(data: { paperId: string; name: string }) {
  return request<RackRoute>("/api/rack-routes", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function assignTruckToRoute(routeId: string, truckId: string | null) {
  return request<RackRoute>(`/api/rack-routes/${routeId}/truck`, {
    method: "PATCH",
    body: JSON.stringify({ truckId }),
  });
}

export function addRackRouteStop(routeId: string, data: { dealerId: string; sequence: number }) {
  return request<RackRouteStop>(`/api/rack-routes/${routeId}/stops`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// --- Press runs ---

export function fetchPressRuns(paperId?: string) {
  const params = paperId ? `?paperId=${paperId}` : "";
  return request<PressRun[]>(`/api/press-runs${params}`);
}

export function createPressRun(data: { paperId: string; runDate: string; bundleSize: number }) {
  return request<PressRun>("/api/press-runs", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function fetchPressOrder(pressRunId: string) {
  return request<PressOrder>(`/api/press-runs/${pressRunId}/press-order`);
}

// --- Statements ---

export function fetchStatement(dealerId: string, paperId: string, month: string) {
  const params = new URLSearchParams({ dealerId, paperId, month });
  return request<Statement>(`/api/statements?${params.toString()}`);
}

export function fetchBatchStatements(month: string) {
  const params = new URLSearchParams({ month });
  return request<BatchStatements>(`/api/statements/batch?${params.toString()}`);
}

export { getToken };
// --- Subscription rates ---

export interface Rate {
  id: string;
  paperId: string;
  paper: Paper;
  newzwareId: number;
  code: string;
  description: string;
  onlineDescription: string | null;
  deliveryMethod: "CARRIER" | "MAIL" | "DIGITAL";
  product: "PRINT" | "DIGITAL" | "PRINT_DIGITAL";
  issueDays: string;
  lengthCount: number;
  lengthUnit: "WEEKS" | "DAYS";
  zone: string | null;
  payMethod: "PAID" | "COMP";
  easyPay: boolean;
  isGift: boolean;
  isOldRate: boolean;
  priceCents: number;
  fullRateCents: number;
  step: number;
  nextStep: number;
  chainKey: string;
  effectiveDate: string | null;
  inactiveDate: string | null;
  showOnline: boolean;
  glAccount: string | null;
  active: boolean;
}

export function fetchRates(paperId?: string, includeInactive = false) {
  const params = new URLSearchParams();
  if (paperId) params.set("paperId", paperId);
  if (includeInactive) params.set("includeInactive", "true");
  return request<Rate[]>(`/api/rates?${params.toString()}`);
}

export function updateRate(id: string, data: Partial<Rate>) {
  return request<Rate>(`/api/rates/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}