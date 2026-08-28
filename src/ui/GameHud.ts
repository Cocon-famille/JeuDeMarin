import { World } from "../world/World";
import { DriveHud } from "./DriveHud";
import { WalkHud } from "./WalkHud";
import { ToastStack } from "./Toast";
import { WheelBannerUI } from "./WheelBanner";
import { ShopUI } from "./ShopUI";
import { copy } from "../content/copy";

export class GameHud {
  private driveHud: DriveHud;
  private pedestrianHud: WalkHud;
  private swimHud: WalkHud;
  private toast: ToastStack;
  private wheelBanner: WheelBannerUI;
  private shop: ShopUI;

  constructor(hudRoot: HTMLElement, private world: World) {
    this.driveHud = new DriveHud(hudRoot, world.state, world.input);
    this.pedestrianHud = new WalkHud(hudRoot, { mode: "pedestrian", label: "Piéton", badgeClass: "tt-badge-pedestrian" }, world.state, world.input);
    this.swimHud = new WalkHud(hudRoot, { mode: "swim", label: "Nage", badgeClass: "tt-badge-swim" }, world.state, world.input);
    this.toast = new ToastStack(hudRoot, world.state);
    this.wheelBanner = new WheelBannerUI(hudRoot, world.wheel);
    this.shop = new ShopUI(hudRoot, (def) => {
      world.swapVehicle(def);
      this.shop.close();
    });

    world.onWheelDetected = () => this.wheelBanner.showDetected();
    world.onWheelStep = (step, progress) => this.wheelBanner.setStepProgress(step, progress);
    world.onWheelCalibrated = () => this.wheelBanner.hideCalibration();

    void this.toast; // keeps the toast stack alive/subscribed
  }

  update() {
    const mode = this.world.state.mode;
    this.driveHud.setVisible(mode === "drive");
    this.pedestrianHud.setVisible(mode === "pedestrian" && !this.shop.isOpen);
    this.swimHud.setVisible(mode === "swim");

    if (mode === "drive") {
      this.driveHud.updateVehicleLabel(this.world.vehicle.def);
      this.driveHud.update();
    } else if (mode === "pedestrian") {
      this.pedestrianHud.update();
      if (this.world.nearVehicle) this.pedestrianHud.setPrompt(copy.ui.reEnter, "E");
      else if (this.world.nearShop) this.pedestrianHud.setPrompt("Voir la vitrine", "E");
      else this.pedestrianHud.setPrompt(null);
    } else {
      this.swimHud.update();
      this.swimHud.setPrompt(copy.swim.exitWater, "F");
    }

    this.wheelBanner.update();

    if (this.world.nearShop && this.world.input.justPressed("KeyE") && mode === "pedestrian" && !this.world.nearVehicle) {
      if (this.shop.isOpen) this.shop.close();
      else this.shop.open(this.world.vehicle.def.id);
    }
    if (this.shop.isOpen && this.world.input.justPressed("Escape")) this.shop.close();
  }

  get shopOpen() {
    return this.shop.isOpen;
  }
}
