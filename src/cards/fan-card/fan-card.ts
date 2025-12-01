import { HassEntity } from "home-assistant-js-websocket";
import {
  css,
  CSSResultGroup,
  html,
  nothing,
  PropertyValues,
  TemplateResult,
} from "lit";
import { customElement, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { styleMap } from "lit/directives/style-map.js";
import {
  actionHandler,
  ActionHandlerEvent,
  computeRTL,
  handleAction,
  hasAction,
  HomeAssistant,
  isActive,
  LovelaceCard,
  LovelaceCardEditor,
} from "../../ha";
import "../../shared/badge-icon";
import "../../shared/button";
import "../../shared/card";
import "../../shared/shape-avatar";
import "../../shared/shape-icon";
import "../../shared/state-info";
import "../../shared/state-item";
import { computeAppearance } from "../../utils/appearance";
import { MushroomBaseCard } from "../../utils/base-card";
import { cardStyle } from "../../utils/card-styles";
import { registerCustomCard } from "../../utils/custom-cards";
import { computeEntityPicture } from "../../utils/info";
import {
  FAN_CARD_EDITOR_NAME,
  FAN_CARD_NAME,
  FAN_ENTITY_DOMAINS,
} from "./const";
import "./controls/fan-oscillate-control";
import "./controls/fan-direction-control";
import "./controls/fan-percentage-control";
import { FanCardConfig } from "./fan-card-config";
import { getPercentage } from "./utils";

registerCustomCard({
  type: FAN_CARD_NAME,
  name: "Super Mushroom Fan Card",
  description: "Card for fan entity",
});

@customElement("super-mushroom-fan-card")
export class FanCard
  extends MushroomBaseCard<FanCardConfig>
  implements LovelaceCard
{
  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    await import("./fan-card-editor");
    return document.createElement(FAN_CARD_EDITOR_NAME) as LovelaceCardEditor;
  }

  public static async getStubConfig(
    hass: HomeAssistant
  ): Promise<FanCardConfig> {
    const entities = Object.keys(hass.states);
    const fans = entities.filter((e) =>
      FAN_ENTITY_DOMAINS.includes(e.split(".")[0])
    );
    return {
      type: `custom:${FAN_CARD_NAME}`,
      entity: fans[0],
      timer_enabled: false,
      timer_duration: 300,
      motion_enabled: false,
    };
  }

  @state() private _timerRemaining?: number; // seconds remaining
  @state() private _showSettingsModal = false;
  private _timerInterval?: number;
  private _timerExpirationTime?: number; // timestamp when timer expires
  private _stateUnsub?: () => void;
  private _motionUnsub?: () => void; // For motion sensor subscription

  @state()
  private percentage?: number;

  protected get hasControls(): boolean {
    return (
      Boolean(this._config?.show_percentage_control) ||
      Boolean(this._config?.show_oscillate_control) ||
      Boolean(this._config?.show_direction_control)
    );
  }

  setConfig(config: FanCardConfig): void {
    try {
      // Ensure all optional properties have safe defaults
      const safeConfig: FanCardConfig = {
        tap_action: {
          action: "toggle",
        },
        hold_action: {
          action: "more-info",
        },
        ...config,
        // Ensure timer properties are defined
        timer_enabled: config.timer_enabled ?? false,
        timer_duration: config.timer_duration ?? 300,
        motion_enabled: config.motion_enabled ?? false,
        motion_sensor: config.motion_sensor ?? undefined,
      };
      
      super.setConfig(safeConfig);
      this.updatePercentage();
      
      // Only update if hass is available
      if (this.hass) {
        this.initializeTimer();
      }
    } catch (error) {
      console.error("Super Mushroom Fan Card: Error setting config", error);
    }
  }

  protected updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);
    try {
      if (this.hass && changedProperties.has("hass")) {
        this.updatePercentage();
        this.initializeTimer();
        this.checkTimerState();
        this.subscribeToStateChanges();
        this.subscribeToMotionSensor();
      }
      if (changedProperties.has("_config")) {
        this.initializeTimer();
        this.checkTimerState();
        if (this.hass) {
          this.subscribeToStateChanges();
          this.subscribeToMotionSensor();
        }
      }
    } catch (error) {
      console.warn("Super Mushroom Fan Card: Error in updated lifecycle", error);
    }
  }

  connectedCallback() {
    super.connectedCallback();
    try {
      if (this.hass) {
        this.initializeTimer();
        this.checkTimerState();
        this.subscribeToStateChanges();
        this.subscribeToMotionSensor();
      }
    } catch (error) {
      console.warn("Super Mushroom Fan Card: Error in connectedCallback", error);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.clearTimer();
    if (this._stateUnsub) {
      this._stateUnsub();
      this._stateUnsub = undefined;
    }
    if (this._motionUnsub) {
      this._motionUnsub();
      this._motionUnsub = undefined;
    }
  }

  private subscribeToStateChanges(): void {
    if (!this.hass?.connection || !this._config?.entity) {
      if (this._stateUnsub) {
        try {
          this._stateUnsub();
        } catch (e) {
          // Ignore errors during cleanup
        }
        this._stateUnsub = undefined;
      }
      return;
    }

    if (this._stateUnsub) {
      try {
        this._stateUnsub();
      } catch (e) {
        // Ignore errors during cleanup
      }
      this._stateUnsub = undefined;
    }

    try {
      this.hass.connection.subscribeEvents(
        (ev: any) => {
          try {
            if (ev?.data?.entity_id === this._config?.entity) {
              const newState = ev.data.new_state;
              const oldState = ev.data.old_state;
              
              // If fan just turned on and timer is enabled, start timer
              if (
                newState?.state === "on" &&
                oldState?.state !== "on" &&
                this._config?.timer_enabled &&
                !this._timerRemaining
              ) {
                this.startTimer();
              }
              
              // If fan just turned off, clear timer
              if (
                newState?.state === "off" &&
                oldState?.state === "on"
              ) {
                if (this._config?.timer_enabled) {
                  this.clearTimer();
                }
              }
              
              // Update percentage display
              this.updatePercentage();
            }
          } catch (e) {
            console.warn("Super Mushroom Fan Card: Error in state change handler", e);
          }
        },
        "state_changed"
      ).then((unsub) => {
        this._stateUnsub = unsub;
      }).catch((e) => {
        console.warn("Super Mushroom Fan Card: Error subscribing to state changes", e);
      });
    } catch (e) {
      console.warn("Super Mushroom Fan Card: Error subscribing to state changes", e);
    }
  }

  private subscribeToMotionSensor(): void {
    if (!this.hass?.connection || !this._config?.motion_enabled || !this._config?.motion_sensor || !this._config?.entity) {
      if (this._motionUnsub) {
        try {
          this._motionUnsub();
        } catch (e) {
          // Ignore errors during cleanup
        }
        this._motionUnsub = undefined;
      }
      return;
    }

    if (this._motionUnsub) {
      try {
        this._motionUnsub();
      } catch (e) {
        // Ignore errors during cleanup
      }
      this._motionUnsub = undefined;
    }

    try {
      this.hass.connection.subscribeEvents(
        (ev: any) => {
          try {
            if (ev?.data?.entity_id === this._config?.motion_sensor) {
              const newState = ev.data.new_state;
              const oldState = ev.data.old_state;
              
              // If motion sensor turns on (motion detected), turn on the fan
              if (
                newState?.state === "on" &&
                oldState?.state !== "on" &&
                this._config?.entity &&
                this.hass
              ) {
                this.hass.callService("fan", "turn_on", {
                  entity_id: this._config.entity,
                });
                
                // Start timer if enabled
                if (this._config?.timer_enabled && !this._timerRemaining) {
                  setTimeout(() => this.startTimer(), 200);
                }
              }
            }
          } catch (e) {
            console.warn("Super Mushroom Fan Card: Error in motion sensor handler", e);
          }
        },
        "state_changed"
      ).then((unsub) => {
        this._motionUnsub = unsub;
      }).catch((e) => {
        console.warn("Super Mushroom Fan Card: Error subscribing to motion sensor", e);
      });
    } catch (e) {
      console.warn("Super Mushroom Fan Card: Error subscribing to motion sensor", e);
    }
  }

  updatePercentage() {
    this.percentage = undefined;
    const stateObj = this._stateObj;
    if (!this._config || !this.hass || !stateObj) return;
    this.percentage = getPercentage(stateObj);
  }

  private onCurrentPercentageChange(e: CustomEvent<{ value?: number }>): void {
    if (e.detail.value != null) {
      this.percentage = Math.round(e.detail.value);
    }
  }

  private _handleAction(ev: ActionHandlerEvent) {
    if (!this.hass || !this._config || !this._stateObj) {
      return;
    }

    try {
      const actionType = ev.detail?.action;
      if (actionType === "tap") {
        const tapAction = this._config.tap_action;
        if (tapAction?.action === "toggle") {
          const wasOff = !isActive(this._stateObj);
          
          // If turning on and timer is enabled, start timer after toggle
          if (wasOff && this._config.timer_enabled) {
            handleAction(this, this.hass, this._config, actionType);
            setTimeout(() => {
              if (this._stateObj && isActive(this._stateObj)) {
                this.startTimer();
              }
            }, 300);
            return;
          }
          
          // If turning off, clear timer
          if (!wasOff) {
            if (this._config.timer_enabled) {
              this.clearTimer();
            }
          }
        }
      }
      handleAction(this, this.hass, this._config, actionType);
    } catch (e) {
      console.warn("Super Mushroom Fan Card: Error handling action", e);
    }
  }

  // Timer methods
  private initializeTimer(): void {
    if (!this._config?.timer_enabled || !this._config.entity) {
      if (this._timerInterval) {
        clearInterval(this._timerInterval);
        this._timerInterval = undefined;
      }
      this._timerRemaining = undefined;
      this._timerExpirationTime = undefined;
      return;
    }

    const entityState = this._stateObj || (this.hass?.states?.[this._config.entity]);
    if (!entityState) {
      return;
    }

    const isFanOn = isActive(entityState);
    
    if (isFanOn) {
      this.calculateRemainingTime();
      
      if (this._timerRemaining != null && this._timerRemaining > 0) {
        if (!this._timerInterval) {
          this.startTimerInterval();
        }
      } else if (this._timerRemaining != null && this._timerRemaining <= 0) {
        this.turnOffFan();
        this.clearTimer();
      } else if (this._timerRemaining == null) {
        this.startTimer();
      }
    } else {
      this.clearTimer();
    }
  }

  private calculateRemainingTime(): void {
    if (!this._config?.timer_enabled || !this._config.entity || !this.hass) {
      this._timerRemaining = 0;
      return;
    }
    
    try {
      const timerKey = `timer_expiration_${this._config.entity}`;
      const expirationTimeStr = localStorage.getItem(timerKey);
      
      if (expirationTimeStr) {
        const expirationTime = parseInt(expirationTimeStr, 10);
        if (!isNaN(expirationTime)) {
          const now = Date.now();
          const remaining = Math.max(0, Math.floor((expirationTime - now) / 1000));
          this._timerRemaining = remaining;
          this._timerExpirationTime = expirationTime;
        } else {
          this._timerRemaining = 0;
        }
      } else {
        const entityState = this._stateObj || (this.hass?.states?.[this._config.entity]);
        if (entityState && isActive(entityState) && entityState.last_changed) {
          const startTime = new Date(entityState.last_changed).getTime();
          const duration = this._config.timer_duration || 300;
          const expirationTime = startTime + (duration * 1000);
          const now = Date.now();
          
          if (now < expirationTime) {
            const remaining = Math.floor((expirationTime - now) / 1000);
            this._timerRemaining = remaining;
            this._timerExpirationTime = expirationTime;
            localStorage.setItem(timerKey, expirationTime.toString());
            if (this._config.entity) {
              localStorage.setItem(`timer_start_${this._config.entity}`, startTime.toString());
            }
          } else {
            this._timerRemaining = 0;
            localStorage.removeItem(timerKey);
            if (this._config.entity) {
              localStorage.removeItem(`timer_start_${this._config.entity}`);
            }
          }
        } else {
          this._timerRemaining = 0;
        }
      }
    } catch (error) {
      console.warn("Super Mushroom Fan Card: Error calculating remaining time", error);
      this._timerRemaining = 0;
    }
  }

  private checkTimerState(): void {
    if (!this._config?.timer_enabled || !this._config.entity) {
      if (this._timerInterval) {
        clearInterval(this._timerInterval);
        this._timerInterval = undefined;
      }
      this._timerRemaining = undefined;
      this._timerExpirationTime = undefined;
      return;
    }

    const entityState = this._stateObj || (this.hass?.states?.[this._config.entity]);
    if (!entityState) {
      return;
    }

    if (!isActive(entityState)) {
      this.clearTimer();
      return;
    }

    if (isActive(entityState) && this._timerRemaining == null && !this._timerInterval) {
      const timerKey = `timer_expiration_${this._config.entity}`;
      const storedExpiration = localStorage.getItem(timerKey);
      
      if (storedExpiration) {
        const expirationTime = parseInt(storedExpiration, 10);
        if (!isNaN(expirationTime)) {
          const now = Date.now();
          const calculatedRemaining = Math.max(0, Math.ceil((expirationTime - now) / 1000));
          
          if (calculatedRemaining > 0) {
            this._timerExpirationTime = expirationTime;
            this._timerRemaining = calculatedRemaining;
            this.startTimerInterval();
            return;
          } else {
            this.turnOffFan();
            this.clearTimer();
            return;
          }
        }
      }
      
      this.startTimer();
    }
  }

  private startTimer(): void {
    if (!this._config?.timer_enabled || !this._config.entity) {
      return;
    }

    setTimeout(() => {
      const entityState = this._stateObj || (this.hass?.states?.[this._config.entity]);
      if (!entityState || !isActive(entityState)) {
        return;
      }

      const duration = (this._config?.timer_duration || 300);
      const startTime = entityState.last_changed 
        ? new Date(entityState.last_changed).getTime() 
        : Date.now();
      const expirationTime = startTime + (duration * 1000);
      
      if (this._config.entity) {
        const timerKey = `timer_expiration_${this._config.entity}`;
        localStorage.setItem(timerKey, expirationTime.toString());
        localStorage.setItem(`timer_start_${this._config.entity}`, startTime.toString());
      }

      this._timerExpirationTime = expirationTime;
      this.calculateRemainingTime();
      
      if (this._timerInterval) {
        clearInterval(this._timerInterval);
        this._timerInterval = undefined;
      }
      
      this.startTimerInterval();
    }, 200);
  }

  private startTimerInterval(): void {
    if (this._timerInterval) {
      clearInterval(this._timerInterval);
      this._timerInterval = undefined;
    }
    
    this._timerInterval = window.setInterval(() => {
      this.updateTimer();
    }, 1000);
  }

  private updateTimer(): void {
    if (!this._config?.timer_enabled || !this._config.entity) {
      this.clearTimer();
      return;
    }

    if (!this._stateObj || !isActive(this._stateObj)) {
      this.clearTimer();
      return;
    }

    if (this._timerRemaining == null || this._timerRemaining <= 0) {
      if (this._timerExpirationTime) {
        const now = Date.now();
        const remaining = Math.max(0, Math.ceil((this._timerExpirationTime - now) / 1000));
        this._timerRemaining = remaining > 0 ? remaining : 0;
      } else {
        this.clearTimer();
        return;
      }
    } else {
      this._timerRemaining = Math.max(0, this._timerRemaining - 1);
    }
    
    this.requestUpdate();

    if (this._timerRemaining <= 0) {
      this.turnOffFan();
      this.clearTimer();
    }
  }

  private clearTimer(): void {
    if (this._timerInterval) {
      clearInterval(this._timerInterval);
      this._timerInterval = undefined;
    }
    this._timerRemaining = undefined;
    this._timerExpirationTime = undefined;

    if (this._config?.entity) {
      const timerKey = `timer_expiration_${this._config.entity}`;
      localStorage.removeItem(timerKey);
      localStorage.removeItem(`timer_start_${this._config.entity}`);
    }
  }
  
  private turnOffFan(): void {
    if (!this.hass || !this._config?.entity) return;
    
    try {
      this.hass.callService("fan", "turn_off", {
        entity_id: this._config.entity,
      });
    } catch (e) {
      console.warn("Super Mushroom Fan Card: Error turning off fan", e);
    }
  }

  private formatTime(seconds: number): string {
    if (seconds < 0) seconds = 0;
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  }

  protected render() {
    if (!this._config || !this.hass || !this._config.entity) {
      return nothing;
    }

    const stateObj = this._stateObj;

    if (!stateObj) {
      return this.renderNotFound(this._config);
    }

    const name = this._config.name || stateObj.attributes.friendly_name || "";
    const icon = this._config.icon;
    const appearance = computeAppearance(this._config);
    const picture = computeEntityPicture(stateObj, appearance.icon_type);

    let stateDisplay = this.hass.formatEntityState(stateObj);
    if (this.percentage != null && stateObj.state === "on") {
      const percentage = this.hass.formatEntityAttributeValue(
        stateObj,
        "percentage",
        this.percentage
      );
      stateDisplay = percentage;
    }
    
    // Add timer countdown next to state/percentage if timer is enabled and active
    if (
      this._config?.timer_enabled &&
      isActive(stateObj) &&
      this._timerRemaining != null &&
      this._timerRemaining >= 0
    ) {
      const timeStr = this.formatTime(this._timerRemaining);
      stateDisplay = `${stateDisplay} • ${timeStr}`;
    }

    const rtl = computeRTL(this.hass);

    const displayControls =
      (!this._config.collapsible_controls || isActive(stateObj)) &&
      (this._config.show_percentage_control ||
        this._config.show_oscillate_control ||
        this._config.show_direction_control);

    return html`
      <ha-card
        class=${classMap({ "fill-container": appearance.fill_container })}
      >
        <mushroom-card .appearance=${appearance} ?rtl=${rtl}>
          ${appearance.layout !== "horizontal" ? this.renderSettingsIcon() : nothing}
          <mushroom-state-item
            ?rtl=${rtl}
            .appearance=${appearance}
            @action=${this._handleAction}
            .actionHandler=${actionHandler({
              hasHold: hasAction(this._config.hold_action),
              hasDoubleClick: hasAction(this._config.double_tap_action),
            })}
          >
            ${picture
              ? this.renderPicture(picture)
              : this.renderIcon(stateObj, icon)}
            ${this.renderBadge(stateObj)}
            ${this.renderTimerIcon()}
            ${this.renderMotionIcon()}
            ${this.renderStateInfo(stateObj, appearance, name, stateDisplay)};
          </mushroom-state-item>
          ${displayControls
            ? html`
                <div class="actions" ?rtl=${rtl}>
                  ${this._config.show_percentage_control
                    ? html`
                        <mushroom-fan-percentage-control
                          .hass=${this.hass}
                          .entity=${stateObj}
                          @current-change=${this.onCurrentPercentageChange}
                        ></mushroom-fan-percentage-control>
                      `
                    : nothing}
                  ${this._config.show_oscillate_control
                    ? html`
                        <mushroom-fan-oscillate-control
                          .hass=${this.hass}
                          .entity=${stateObj}
                        ></mushroom-fan-oscillate-control>
                      `
                    : nothing}
                  ${this._config.show_direction_control
                  ? html`
                      <mushroom-fan-direction-control
                        .hass=${this.hass}
                        .entity=${stateObj}
                      ></mushroom-fan-direction-control>
                    `
                  : nothing}
                  ${appearance.layout === "horizontal" ? this.renderSettingsIcon() : nothing}
                </div>
              `
            : nothing}
        </mushroom-card>
        ${this.renderSettingsModal()}
      </ha-card>
    `;
  }

  protected renderTimerIcon(): TemplateResult | typeof nothing {
    if (!this._config?.timer_enabled) {
      return nothing;
    }
    const hasMotion = this._config?.motion_enabled;
    const topOffset = hasMotion ? "-8px" : "-3px";
    const rtl = computeRTL(this.hass);
    const horizontalPos = rtl ? "left: -3px; right: auto;" : "right: -3px; left: auto;";
    return html`
      <div slot="badge" class="timer-badge-wrapper" style="position: absolute; top: ${topOffset}; ${horizontalPos} bottom: auto;">
        <mushroom-badge-icon
          class="timer-badge"
          .icon=${"mdi:timer-outline"}
          style="--main-color: var(--rgb-secondary-text-color);"
        ></mushroom-badge-icon>
      </div>
    `;
  }

  protected renderMotionIcon(): TemplateResult | typeof nothing {
    if (!this._config?.motion_enabled) {
      return nothing;
    }
    const hasTimer = this._config?.timer_enabled;
    const topOffset = hasTimer ? "-8px" : "-3px";
    const rtl = computeRTL(this.hass);
    const horizontalPos = rtl ? "right: -3px; left: auto;" : "left: -3px; right: auto;";
    return html`
      <div slot="badge" class="motion-badge-wrapper" style="position: absolute; top: ${topOffset}; ${horizontalPos} bottom: auto;">
        <mushroom-badge-icon
          class="motion-badge"
          .icon=${"mdi:motion-sensor"}
          style="--main-color: var(--rgb-secondary-text-color);"
        ></mushroom-badge-icon>
      </div>
    `;
  }

  protected renderSettingsIcon(): TemplateResult | typeof nothing {
    if (!this._config) {
      return nothing;
    }
    return html`
      <div class="settings-icon-container" @click=${this._openSettings} title="Settings">
        <ha-icon
          .icon=${"mdi:cog"}
          class="settings-icon"
        ></ha-icon>
      </div>
    `;
  }

  private _openSettings(e: Event): void {
    e.stopPropagation();
    e.preventDefault();
    this._showSettingsModal = true;
    this.requestUpdate();
  }

  private _closeSettingsModal(): void {
    this._showSettingsModal = false;
    this.requestUpdate();
  }

  private _handleTimerToggle(e: Event): void {
    const target = e.target as any;
    const enabled = target.checked;
    if (this._config) {
      const newConfig = {
        ...this._config,
        timer_enabled: enabled,
      };
      this._updateConfig(newConfig);
    }
  }

  private _handleMotionToggle(e: Event): void {
    const target = e.target as any;
    const enabled = target.checked;
    if (this._config) {
      const newConfig = {
        ...this._config,
        motion_enabled: enabled,
      };
      this._updateConfig(newConfig);
    }
  }

  private _handleTimerDurationChange(e: Event): void {
    const target = e.target as any;
    const duration = parseInt(target.value, 10);
    if (this._config && !isNaN(duration) && duration > 0) {
      const newConfig = {
        ...this._config,
        timer_duration: duration,
      };
      this._updateConfig(newConfig);
    }
  }

  private _updateConfig(newConfig: FanCardConfig): void {
    this.setConfig(newConfig);
    const event = new CustomEvent("config-changed", {
      bubbles: true,
      composed: true,
      detail: { config: newConfig },
    });
    this.dispatchEvent(event);
    this.requestUpdate();
  }

  protected renderSettingsModal(): TemplateResult | typeof nothing {
    if (!this._showSettingsModal || !this._config || !this.hass) {
      return nothing;
    }

    return html`
      <div class="settings-modal-overlay" @click=${this._closeSettingsModal}>
        <div class="settings-modal" @click=${(e: Event) => e.stopPropagation()}>
          <div class="settings-modal-header">
            <div class="settings-modal-title">Settings</div>
            <ha-icon-button
              .icon=${"mdi:close"}
              @click=${this._closeSettingsModal}
              class="settings-modal-close"
            ></ha-icon-button>
          </div>
          <div class="settings-modal-content">
            <div class="settings-section">
              <div class="settings-row">
                <div class="settings-label-group">
                  <div class="settings-label">Enable Timer</div>
                  <div class="settings-description">
                    Automatically turn off after duration
                  </div>
                </div>
                <ha-switch
                  .checked=${this._config.timer_enabled || false}
                  @change=${this._handleTimerToggle}
                ></ha-switch>
              </div>
              ${this._config.timer_enabled
                ? html`
                    <div class="settings-row">
                      <div class="settings-label">Timer Duration (seconds)</div>
                      <ha-textfield
                        .value=${String(this._config.timer_duration || 300)}
                        type="number"
                        min="1"
                        max="3000"
                        @change=${this._handleTimerDurationChange}
                        class="settings-input"
                      ></ha-textfield>
                    </div>
                  `
                : nothing}
            </div>
            <div class="settings-section">
              <div class="settings-row">
                <div class="settings-label-group">
                  <div class="settings-label">Enable Motion Sensor</div>
                  <div class="settings-description">
                    Automatically control based on motion
                  </div>
                </div>
                <ha-switch
                  .checked=${this._config.motion_enabled || false}
                  @change=${this._handleMotionToggle}
                ></ha-switch>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  protected renderIcon(stateObj: HassEntity, icon?: string): TemplateResult {
    let iconStyle = {};
    const percentage = getPercentage(stateObj);
    const active = isActive(stateObj);
    if (active) {
      if (percentage) {
        const speed = 1.5 * (percentage / 100) ** 0.5;
        iconStyle["--animation-duration"] = `${1 / speed}s`;
      } else {
        iconStyle["--animation-duration"] = `1s`;
      }
    }

    return html`
      <mushroom-shape-icon
        slot="icon"
        class=${classMap({
          spin: active && Boolean(this._config?.icon_animation),
        })}
        style=${styleMap(iconStyle)}
        .disabled=${!active}
      >
        <ha-state-icon
          .hass=${this.hass}
          .stateObj=${stateObj}
          .icon=${icon}
        ></ha-state-icon>
      </mushroom-shape-icon>
    `;
  }

  static get styles(): CSSResultGroup {
    return [
      super.styles,
      cardStyle,
      css`
        mushroom-state-item {
          cursor: pointer;
        }
        mushroom-shape-icon {
          --icon-color: rgb(var(--rgb-state-fan));
          --shape-color: rgba(var(--rgb-state-fan), 0.2);
        }
        .spin ha-state-icon {
          animation: var(--animation-duration) infinite linear spin;
        }
        mushroom-fan-percentage-control {
          flex: 1;
        }
        ha-card {
          position: relative;
        }
        .settings-icon-container {
          position: absolute;
          top: 8px;
          right: 8px;
          left: auto;
          z-index: 1000;
          cursor: pointer;
          pointer-events: auto;
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
          align-items: center;
          justify-content: center;
        }
        .actions .settings-icon-container {
          position: relative;
          top: auto;
          right: auto;
          left: auto;
          margin-left: 8px;
          flex-shrink: 0;
        }
        .settings-icon {
          --mdc-icon-size: 16px;
          color: var(--secondary-text-color);
          opacity: 0.7;
          pointer-events: auto;
          display: block !important;
          visibility: visible !important;
          width: 16px;
          height: 16px;
        }
        .settings-icon:hover {
          opacity: 1 !important;
        }
        .settings-icon-container ha-icon {
          pointer-events: auto;
          display: block !important;
          visibility: visible !important;
        }
        mushroom-card {
          position: relative;
        }
        .settings-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          z-index: 10000;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .settings-modal {
          background-color: var(--card-background-color, #fff);
          border-radius: var(--mdc-shape-medium, 4px);
          box-shadow: 0 8px 10px 1px rgba(0, 0, 0, 0.14),
            0 3px 14px 2px rgba(0, 0, 0, 0.12),
            0 5px 5px -3px rgba(0, 0, 0, 0.2);
          max-width: 500px;
          width: 90%;
          max-height: 90vh;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
        }
        .settings-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 24px;
          border-bottom: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
        }
        .settings-modal-title {
          font-size: 20px;
          font-weight: 500;
          color: var(--primary-text-color);
        }
        .settings-modal-close {
          color: var(--secondary-text-color);
        }
        .settings-modal-content {
          padding: 24px;
          flex: 1;
        }
        .settings-section {
          margin-bottom: 24px;
        }
        .settings-section:last-child {
          margin-bottom: 0;
        }
        .settings-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
          gap: 16px;
        }
        .settings-row:last-child {
          margin-bottom: 0;
        }
        .settings-label-group {
          flex: 1;
        }
        .settings-label {
          font-size: 14px;
          font-weight: 500;
          color: var(--primary-text-color);
          margin-bottom: 4px;
        }
        .settings-description {
          font-size: 12px;
          color: var(--secondary-text-color);
        }
        .settings-input {
          width: 150px;
          flex-shrink: 0;
        }
      `,
    ];
  }
}
