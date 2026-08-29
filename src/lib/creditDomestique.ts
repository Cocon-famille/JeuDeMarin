import { creditDomestique } from "./creditDomestiqueClient";

/** $ jeu accordés par euro de Crédit Domestique dépensé. */
export const GAME_MONEY_PER_EURO = 100;

export interface CDAccount {
  id: string;
  role: "admin" | "parent" | "child" | "company" | "bank";
  holderName: string;
}

export type ChargeStatus = "pending" | "accepted" | "refused";

const TRACTOPOLIS_HOLDER_NAME = "TRACTOPOLIS";
let cachedCompanyId: string | null = null;

export async function fetchHouseholdAccounts(): Promise<CDAccount[]> {
  const { data, error } = await creditDomestique
    .from("accounts")
    .select("id, role, holder_name")
    .eq("archived", false)
    .in("role", ["child", "parent", "admin"])
    .order("role", { ascending: false }); // child, parent, admin — kids first
  if (error) throw error;
  return data.map((row) => ({ id: row.id, role: row.role, holderName: row.holder_name }));
}

/** Trouve le compte entreprise "TRACTOPOLIS", ou le crée s'il n'existe pas encore. */
export async function ensureTractopolisCompany(): Promise<string> {
  if (cachedCompanyId) return cachedCompanyId;

  const { data: existing, error: findError } = await creditDomestique
    .from("accounts")
    .select("id")
    .eq("role", "company")
    .eq("holder_name", TRACTOPOLIS_HOLDER_NAME)
    .maybeSingle();
  if (findError) throw findError;
  if (existing) {
    cachedCompanyId = existing.id;
    return existing.id;
  }

  const id = crypto.randomUUID();
  const { error: insertError } = await creditDomestique.from("accounts").insert({
    id,
    role: "company",
    holder_name: TRACTOPOLIS_HOLDER_NAME,
    card_number: "5555010203040506",
    cvc: "000",
    expiry: "12/30",
    balance: 0,
    created_at: new Date().toISOString(),
    archived: false,
  });
  if (insertError) throw insertError;
  cachedCompanyId = id;
  return id;
}

export async function requestGameMoneyCharge(payerId: string, euros: number): Promise<string> {
  const companyId = await ensureTractopolisCompany();
  const gameMoney = euros * GAME_MONEY_PER_EURO;
  const chargeId = crypto.randomUUID();
  const { error } = await creditDomestique.from("charges").insert({
    id: chargeId,
    company_id: companyId,
    payer_id: payerId,
    amount: Math.round(euros * 100), // cents
    reason: `Recharge Tractopolis — ${gameMoney.toLocaleString("fr-FR")} $ en jeu`,
    status: "pending",
    requested_at: new Date().toISOString(),
  });
  if (error) throw error;
  return chargeId;
}

export async function getChargeStatus(chargeId: string): Promise<ChargeStatus> {
  const { data, error } = await creditDomestique.from("charges").select("status").eq("id", chargeId).single();
  if (error) throw error;
  return data.status as ChargeStatus;
}
