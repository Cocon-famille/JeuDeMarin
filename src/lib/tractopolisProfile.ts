import { tractopolisDb } from "./tractopolisProfileClient";

export interface ProfileData {
  plate: string;
  money: number;
  ownedVehicleIds: string[];
  claimedTaskIds: string[];
}

function normalizeKey(name: string): string {
  return name.trim().toUpperCase();
}

async function findRow(name: string) {
  const key = normalizeKey(name);
  if (!key) return null;
  const { data, error } = await tractopolisDb.from("tractopolis_profiles").select("*").eq("name_key", key).maybeSingle();
  if (error) throw error;
  return data;
}

export async function loadProfile(name: string): Promise<ProfileData | null> {
  const row = await findRow(name);
  if (!row) return null;
  return {
    plate: row.plate ?? "",
    money: row.money,
    ownedVehicleIds: row.owned_vehicle_ids ?? [],
    claimedTaskIds: row.claimed_task_ids ?? [],
  };
}

export async function saveProfile(name: string, data: ProfileData): Promise<void> {
  const key = normalizeKey(name);
  if (!key) return;
  const row = await findRow(name);
  const payload = {
    plate: data.plate,
    money: data.money,
    owned_vehicle_ids: data.ownedVehicleIds,
    claimed_task_ids: data.claimedTaskIds,
    updated_at: new Date().toISOString(),
  };
  if (row) {
    const { error } = await tractopolisDb.from("tractopolis_profiles").update(payload).eq("id", row.id);
    if (error) throw error;
  } else {
    const { error } = await tractopolisDb.from("tractopolis_profiles").insert({ name, ...payload });
    if (error) throw error;
  }
}
