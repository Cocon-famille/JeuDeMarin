import { GameState } from "../core/GameState";
import { el } from "./dom";
import {
  CDAccount,
  ChargeStatus,
  GAME_MONEY_PER_EURO,
  fetchHouseholdAccounts,
  getChargeStatus,
  requestGameMoneyCharge,
} from "../lib/creditDomestique";

const ACCOUNT_KEY = "tractopolis.cdAccountId";
const ACCOUNT_NAME_KEY = "tractopolis.cdAccountName";
const PENDING_KEY = "tractopolis.cdPendingCharge";

interface PendingCharge {
  id: string;
  euros: number;
}

const ROLE_LABEL: Record<CDAccount["role"], string> = {
  child: "Enfant",
  parent: "Parent",
  admin: "Admin",
  company: "Entreprise",
  bank: "Banque",
};

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStored(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // stockage indisponible — tant pis
  }
}

/**
 * Recharge en $ jeu via Crédit Domestique : on ne débite jamais directement —
 * on pose une demande (Charge) que le titulaire doit valider dans son
 * appli, exactement comme n'importe quelle autre entreprise de leur système.
 */
export class BankPanel {
  readonly root: HTMLElement;
  private pollTimer: number | null = null;

  constructor(parent: HTMLElement, private state: GameState) {
    this.root = el("div", { className: "tt-shop-panel tt-bank-panel tt-hidden" });
    parent.appendChild(this.root);
  }

  get isOpen() {
    return !this.root.classList.contains("tt-hidden");
  }

  open() {
    this.root.classList.remove("tt-hidden");
    this.render();
  }

  close() {
    this.root.classList.add("tt-hidden");
    this.stopPolling();
  }

  private stopPolling() {
    if (this.pollTimer !== null) {
      window.clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private getLinkedAccount(): { id: string; name: string } | null {
    const id = readStored(ACCOUNT_KEY);
    const name = readStored(ACCOUNT_NAME_KEY);
    return id && name ? { id, name } : null;
  }

  private getPendingCharge(): PendingCharge | null {
    const raw = readStored(PENDING_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as PendingCharge;
    } catch {
      return null;
    }
  }

  private async render() {
    const pending = this.getPendingCharge();
    if (pending) {
      this.renderPending(pending);
      return;
    }
    const account = this.getLinkedAccount();
    if (!account) {
      await this.renderAccountPicker();
    } else {
      this.renderAmountForm(account);
    }
  }

  private async renderAccountPicker() {
    this.root.innerHTML = "";
    this.root.append(
      el("div", { className: "tt-shop-title", text: "Crédit Domestique" }),
      el("div", { className: "tt-shop-sub", text: "Chargement des comptes…" }),
    );
    let accounts: CDAccount[];
    try {
      accounts = await fetchHouseholdAccounts();
    } catch {
      this.root.innerHTML = "";
      this.root.append(
        el("div", { className: "tt-shop-title", text: "Crédit Domestique" }),
        el("div", { className: "tt-shop-sub", text: "Connexion impossible pour l'instant. Réessaie plus tard." }),
        this.closeButton(),
      );
      return;
    }

    this.root.innerHTML = "";
    this.root.append(
      el("div", { className: "tt-shop-title", text: "Crédit Domestique" }),
      el("div", { className: "tt-shop-sub", text: "Quel est ton compte ?" }),
    );
    for (const acc of accounts) {
      const item = el("button", { className: "tt-shop-item", attrs: { type: "button" } });
      const text = el("div");
      text.append(
        el("div", { className: "tt-shop-item-label", text: acc.holderName }),
        el("div", { className: "tt-shop-item-kind", text: ROLE_LABEL[acc.role] }),
      );
      item.append(text);
      item.addEventListener("click", () => {
        writeStored(ACCOUNT_KEY, acc.id);
        writeStored(ACCOUNT_NAME_KEY, acc.holderName);
        this.render();
      });
      this.root.append(item);
    }
    this.root.append(this.closeButton());
  }

  private renderAmountForm(account: { id: string; name: string }) {
    this.root.innerHTML = "";
    this.root.append(
      el("div", { className: "tt-shop-title", text: "Crédit Domestique" }),
      el("div", { className: "tt-shop-sub", text: `Compte : ${account.name}` }),
    );

    const row = el("div", { className: "tt-bank-row" });
    const input = el("input", {
      className: "tt-field",
      attrs: { type: "number", min: "1", step: "1", value: "5" },
    }) as HTMLInputElement;
    const button = el("div", { className: "tt-btn-primary", text: "Demander" });
    row.append(input, button);

    const preview = el("div", { className: "tt-bank-preview" });
    const updatePreview = () => {
      const euros = Math.max(0, Math.floor(Number(input.value) || 0));
      preview.innerHTML = `${euros} € → <strong>${(euros * GAME_MONEY_PER_EURO).toLocaleString("fr-FR")} $</strong> en jeu`;
    };
    input.addEventListener("input", updatePreview);
    updatePreview();

    button.addEventListener("click", () => this.submit(account.id, Math.max(1, Math.floor(Number(input.value) || 0))));

    const changeAccount = el("div", { className: "tt-bank-account" });
    const changeBtn = el("button", { text: "Changer de compte", attrs: { type: "button" } });
    changeBtn.addEventListener("click", () => {
      writeStored(ACCOUNT_KEY, null);
      writeStored(ACCOUNT_NAME_KEY, null);
      this.render();
    });
    changeAccount.append(changeBtn);

    this.root.append(row, preview, changeAccount, this.closeButton());
  }

  private async submit(payerId: string, euros: number) {
    this.root.innerHTML = "";
    this.root.append(
      el("div", { className: "tt-shop-title", text: "Crédit Domestique" }),
      el("div", { className: "tt-shop-sub", text: "Envoi de la demande…" }),
    );
    try {
      const chargeId = await requestGameMoneyCharge(payerId, euros);
      writeStored(PENDING_KEY, JSON.stringify({ id: chargeId, euros } satisfies PendingCharge));
      this.render();
    } catch {
      this.state.toast("Demande impossible", "Connexion à Crédit Domestique indisponible.");
      this.render();
    }
  }

  private renderPending(pending: PendingCharge) {
    this.root.innerHTML = "";
    this.root.append(
      el("div", { className: "tt-shop-title", text: "Crédit Domestique" }),
      el("div", {
        className: "tt-bank-status",
        html: `<span>Demande envoyée pour ${(pending.euros * GAME_MONEY_PER_EURO).toLocaleString("fr-FR")} $.</span><span>Va l'accepter sur <strong>credit-domestique.vercel.app</strong>.</span>`,
      }),
      this.closeButton(),
    );
    this.startPolling(pending);
  }

  private startPolling(pending: PendingCharge) {
    this.stopPolling();
    const check = async () => {
      let status: ChargeStatus;
      try {
        status = await getChargeStatus(pending.id);
      } catch {
        return; // connexion capricieuse — on retentera au prochain tic
      }
      if (status === "pending") return;
      this.stopPolling();
      writeStored(PENDING_KEY, null);
      if (status === "accepted") {
        this.state.money += pending.euros * GAME_MONEY_PER_EURO;
        this.state.toast("Recharge acceptée", `+${(pending.euros * GAME_MONEY_PER_EURO).toLocaleString("fr-FR")} $ en jeu.`);
      } else {
        this.state.toast("Demande refusée", "Rien n'a été débité.");
      }
      if (this.isOpen) this.render();
    };
    check();
    this.pollTimer = window.setInterval(check, 4000);
  }

  private closeButton(): HTMLElement {
    const btn = el("div", { className: "tt-shop-close", text: "Fermer" });
    btn.addEventListener("click", () => this.close());
    return btn;
  }

  /** Reprend le suivi d'une demande laissée en attente lors d'une session précédente. */
  resumePendingIfAny() {
    const pending = this.getPendingCharge();
    if (pending) this.startPolling(pending);
  }
}
