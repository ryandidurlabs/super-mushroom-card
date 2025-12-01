import { assign, boolean, number, object, optional, string } from "superstruct";
import { LovelaceCardConfig } from "../../ha";
import {
  ActionsSharedConfig,
  actionsSharedConfigStruct,
} from "../../shared/config/actions-config";
import {
  AppearanceSharedConfig,
  appearanceSharedConfigStruct,
} from "../../shared/config/appearance-config";
import {
  EntitySharedConfig,
  entitySharedConfigStruct,
} from "../../shared/config/entity-config";
import { lovelaceCardConfigStruct } from "../../shared/config/lovelace-card-config";

export type LightCardConfig = LovelaceCardConfig &
  EntitySharedConfig &
  AppearanceSharedConfig &
  ActionsSharedConfig & {
    icon_color?: string;
    show_brightness_control?: boolean;
    show_color_temp_control?: boolean;
    show_color_control?: boolean;
    collapsible_controls?: boolean;
    use_light_color?: boolean;
    // Timer functionality
    timer_enabled?: boolean;
    timer_duration?: number; // in seconds
    default_brightness?: number; // 0-100, optional
  };

export const lightCardConfigStruct = assign(
  lovelaceCardConfigStruct,
  assign(
    entitySharedConfigStruct,
    appearanceSharedConfigStruct,
    actionsSharedConfigStruct
  ),
  object({
    icon_color: optional(string()),
    show_brightness_control: optional(boolean()),
    show_color_temp_control: optional(boolean()),
    show_color_control: optional(boolean()),
    collapsible_controls: optional(boolean()),
    use_light_color: optional(boolean()),
    timer_enabled: optional(boolean()),
    timer_duration: optional(number()),
    default_brightness: optional(number()),
  })
);
