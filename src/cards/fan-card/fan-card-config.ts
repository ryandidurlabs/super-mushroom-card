import { assign, boolean, number, object, optional, string } from "superstruct";
import {
  actionsSharedConfigStruct,
  ActionsSharedConfig,
} from "../../shared/config/actions-config";
import {
  appearanceSharedConfigStruct,
  AppearanceSharedConfig,
} from "../../shared/config/appearance-config";
import {
  entitySharedConfigStruct,
  EntitySharedConfig,
} from "../../shared/config/entity-config";
import { lovelaceCardConfigStruct } from "../../shared/config/lovelace-card-config";
import { LovelaceCardConfig } from "../../ha";

export type FanCardConfig = LovelaceCardConfig &
  EntitySharedConfig &
  AppearanceSharedConfig &
  ActionsSharedConfig & {
    icon_animation?: boolean;
    show_percentage_control?: boolean;
    show_oscillate_control?: boolean;
    show_direction_control?: boolean;
    collapsible_controls?: boolean;
    // Timer functionality
    timer_enabled?: boolean;
    timer_duration?: number; // in seconds
    // Motion functionality
    motion_enabled?: boolean;
    motion_sensor?: string; // entity_id of the motion sensor
  };

export const fanCardConfigStruct = assign(
  lovelaceCardConfigStruct,
  assign(
    entitySharedConfigStruct,
    appearanceSharedConfigStruct,
    actionsSharedConfigStruct
  ),
  object({
    icon_animation: optional(boolean()),
    show_percentage_control: optional(boolean()),
    show_oscillate_control: optional(boolean()),
    show_direction_control: optional(boolean()),
    collapsible_controls: optional(boolean()),
    timer_enabled: optional(boolean()),
    timer_duration: optional(number()),
    motion_enabled: optional(boolean()),
    motion_sensor: optional(string()),
  })
);
