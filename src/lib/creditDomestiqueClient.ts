import { createClient } from "@supabase/supabase-js";

// Crédit Domestique — banque fictive familiale, projet Supabase séparé de
// celui de Tractopolis. Clé publique embarquée par conception (voir son
// propre README) : pas d'auth par utilisateur, RLS ouvertes en lecture et
// écriture. On ne s'y connecte que pour lire les comptes et poser une
// demande de débit (`charges`) — jamais pour écrire dans les écritures ou
// les soldes, qui restent uniquement gérés par leur propre moteur bancaire.
const SUPABASE_URL = "https://zalvstnzvxdcibnbdbwm.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_DR7KL1dgiv-y1wTXnA1X8Q_aeLSQ50H";

export const creditDomestique = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
