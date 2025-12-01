import { html, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { assert } from "superstruct";
import { LovelaceCardEditor, fireEvent } from "../../ha";
import setupCustomlocalize from "../../localize";
import { computeActionsFormSchema } from "../../shared/config/actions-config";
import { APPEARANCE_FORM_SCHEMA } from "../../shared/config/appearance-config";
import { MushroomBaseElement } from "../../utils/base-element";
import { GENERIC_LABELS } from "../../utils/form/generic-fields";
import { HaFormSchema } from "../../utils/form/ha-form";
import { loadHaComponents } from "../../utils/loader";
import { ENTITY_CARD_EDITOR_NAME } from "./const";
import { EntityCardConfig, entityCardConfigStruct } from "./entity-card-config";

const ENTITY_LABELS = [
  "timer_enabled",
  "timer_duration",
  "motion_enabled",
  "motion_sensor",
];

const SCHEMA: HaFormSchema[] = [
  { name: "entity", selector: { entity: {} } },
  { name: "name", selector: { text: {} } },
  {
    type: "grid",
    name: "",
    schema: [
      {
        name: "icon",
        selector: { icon: {} },
        context: { icon_entity: "entity" },
      },
      { name: "icon_color", selector: { mush_color: {} } },
    ],
  },
  ...APPEARANCE_FORM_SCHEMA,
  {
    type: "grid",
    name: "",
    schema: [
      { name: "timer_enabled", selector: { boolean: {} } },
      {
        name: "timer_duration",
        selector: { number: { min: 1, max: 3000, step: 1, unit_of_measurement: "seconds" } },
      },
    ],
  },
  {
    type: "grid",
    name: "",
    schema: [
      { name: "motion_enabled", selector: { boolean: {} } },
      {
        name: "motion_sensor",
        selector: { 
          entity: { 
            domain: ["binary_sensor"],
            filter: {
              device_class: "motion"
            }
          } 
        },
      },
    ],
  },
  ...computeActionsFormSchema(),
];

@customElement(ENTITY_CARD_EDITOR_NAME)
export class EntityCardEditor
  extends MushroomBaseElement
  implements LovelaceCardEditor
{
  @state() private _config?: EntityCardConfig;

  connectedCallback() {
    super.connectedCallback();
    void loadHaComponents();
  }

  public setConfig(config: EntityCardConfig): void {
    assert(config, entityCardConfigStruct);
    this._config = config;
  }

  private _computeLabel = (schema: HaFormSchema) => {
    const customLocalize = setupCustomlocalize(this.hass!);

    if (GENERIC_LABELS.includes(schema.name)) {
      return customLocalize(`editor.card.generic.${schema.name}`);
    }
    if (ENTITY_LABELS.includes(schema.name)) {
      return customLocalize(`editor.card.entity.${schema.name}`);
    }
    return this.hass!.localize(
      `ui.panel.lovelace.editor.card.generic.${schema.name}`
    );
  };

  protected render() {
    if (!this.hass || !this._config) {
      return nothing;
    }

    return html`
      <ha-form
        .hass=${this.hass}
        .data=${this._config}
        .schema=${SCHEMA}
        .computeLabel=${this._computeLabel}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `;
  }

  private _valueChanged(ev: CustomEvent): void {
    fireEvent(this, "config-changed", { config: ev.detail.value });
  }
}
