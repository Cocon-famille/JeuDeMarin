import { createClient } from "@supabase/supabase-js";

// Projet Supabase "cocon", partagé avec les autres apps du foyer — la table
// tractopolis_profiles y vit isolée (policies RLS ouvertes propres à elle
// seule ; les autres tables du projet restent verrouillées derrière leur
// propre auth). Pas de login côté jeu, comme Crédit Domestique : la clé
// publique embarquée suffit, un profil est identifié par son nom.
const SUPABASE_URL = "https://ntxkqofxvaasibnjriqr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_bpffcSe3fin5ttqcanQx9A_RujS7CXs";

export const tractopolisDb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
