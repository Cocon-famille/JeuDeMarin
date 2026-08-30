import * as THREE from "three";
import { World } from "../world/World";
import { DriveHud } from "./DriveHud";
import { WalkHud } from "./WalkHud";
import { ToastStack } from "./Toast";
import { WheelBannerUI } from "./WheelBanner";
import { ShopUI } from "./ShopUI";
import { TopInfoBar } from "./TopInfoBar";
import { MiniMap } from "./MiniMap";
import { WorldIcon } from "./WorldIcon";
import { BankPanel } from "./BankPanel";
import { TasksPanel } from "./TasksPanel";
import { SHOP_POSITION } from "../world/Shop";
import { copy } from "../content/copy";

const SHOP_ICON_POINT = SHOP_POSITION.clone().add(new THREE.Vector3(0, 3, 0));

export class GameHud {
  private driveHud: DriveHud;
  private pedestrianHud: WalkHud;
  private swimHud: WalkHud;
  private toast: ToastStack;
  private wheelBanner: WheelBannerUI;
  private shop: ShopUI;
  private topInfo: TopInfoBar;
  private minimap: MiniMap;
  private worldIcon: WorldIcon;
  private bank: BankPanel;
  private tasks: TasksPanel;
  private minimapExpanded = false;

  constructor(hudRoot: HTMLElement, private world: World) {
    this.driveHud = new DriveHud(hudRoot, world.state, world.input);
    this.pedestrianHud = new WalkHud(hudRoot, { mode: "pedestrian", label: "Piéton", badgeClass: "tt-badge-pedestrian" }, world.state, world.input);
    this.swimHud = new WalkHud(hudRoot, { mode: "swim", label: "Nage", badgeClass: "tt-badge-swim" }, world.state, world.input);
    this.toast = new ToastStack(hudRoot, world.state);
    this.wheelBanner = new WheelBannerUI(hudRoot, world.wheel);
    this.shop = new ShopUI(hudRoot, world.state, (def) => {
      world.swapVehicle(def);
      this.shop.close();
    });
    this.bank = new BankPanel(hudRoot, world.state);
    this.tasks = new TasksPanel(hudRoot, world.state);
    this.topInfo = new TopInfoBar(hudRoot, world.state, {
      onHelp: () => world.state.toast("Commandes", "Joystick pour bouger · F sortir · E interagir/entrer"),
      onMap: () => this.toggleMinimap(),
      onShop: () => this.openShop(),
      onMenu: () => (this.tasks.isOpen ? this.tasks.close() : this.tasks.open()),
      onMoney: () => (this.bank.isOpen ? this.bank.close() : this.bank.open()),
      onView: () => world.toggleView(),
    });
    this.minimap = new MiniMap(hudRoot);
    this.worldIcon = new WorldIcon(hudRoot);

    world.onWheelDetected = () => this.wheelBanner.showDetected();
    world.onWheelStep = (step, progress) => this.wheelBanner.setStepProgress(step, progress);
    world.onWheelCalibrated = () => this.wheelBanner.hideCalibration();

    this.bank.resumePendingIfAny();

    void this.toast; // keeps the toast stack alive/subscribed
  }

  private openShop() {
    if (this.shop.isOpen) {
      this.shop.close();
      return;
    }
    this.world.state.refuel();
    this.shop.open(this.world.vehicle.def.id);
  }

  private toggleMinimap() {
    this.minimapExpanded = !this.minimapExpanded;
    this.minimap.root.classList.toggle("tt-minimap-expanded", this.minimapExpanded);
  }

  update() {
    const mode = this.world.state.mode;
    const modalOpen = this.shop.isOpen || this.bank.isOpen || this.tasks.isOpen;
    this.driveHud.setVisible(mode === "drive" && !modalOpen);
    this.pedestrianHud.setVisible(mode === "pedestrian" && !modalOpen);
    this.swimHud.setVisible(mode === "swim" && !modalOpen);

    if (mode === "drive") {
      this.driveHud.updateVehicleLabel(this.world.vehicle.def);
      this.driveHud.update();
      this.driveHud.setFarmPrompt(this.world.farm.prompt(this.world.vehicle.def.kind));
    } else if (mode === "pedestrian") {
      this.pedestrianHud.update();
      if (this.world.nearVehicle) this.pedestrianHud.setPrompt(copy.ui.reEnter, "E");
      else if (this.world.nearShop) this.pedestrianHud.setPrompt("Voir la vitrine", "E");
      else this.pedestrianHud.setPrompt(null);
    } else {
      this.swimHud.update();
      this.swimHud.setPrompt(copy.swim.exitWater, "F");
    }

    this.topInfo.update();
    this.minimap.update(this.world);
    this.wheelBanner.update();

    const iconTarget =
      mode === "pedestrian" && this.world.nearVehicle
        ? this.world.vehicle.object.position.clone().add(new THREE.Vector3(0, 2.2, 0))
        : mode === "pedestrian" && this.world.nearShop
          ? SHOP_ICON_POINT
          : null;
    this.worldIcon.update(this.world.rig.camera, iconTarget);

    if (this.world.nearShop && this.world.input.justPressed("KeyE") && mode === "pedestrian" && !this.world.nearVehicle) {
      this.openShop();
    }
    if (this.shop.isOpen && this.world.input.justPressed("Escape")) this.shop.close();
    if (this.bank.isOpen && this.world.input.justPressed("Escape")) this.bank.close();
    if (this.tasks.isOpen && this.world.input.justPressed("Escape")) this.tasks.close();
  }

  get shopOpen() {
    return this.shop.isOpen || this.bank.isOpen || this.tasks.isOpen;
  }
}
