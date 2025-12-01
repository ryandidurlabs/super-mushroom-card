import { assign, boolean, number, object, optional, string } from "superstruct";
import {
  ActionsSharedConfig,
  actionsSharedConfigStruct,
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

export type EntityCardConfig = LovelaceCardConfig &
  EntitySharedConfig &
  AppearanceSharedConfig &
  ActionsSharedConfig & {
    icon_color?: string;
    // Timer functionality
    timer_enabled?: boolean;
    timer_duration?: number; // in seconds
    // Motion functionality
    motion_enabled?: boolean;
    motion_sensor?: string; // entity_id of the motion sensor
  };

export const entityCardConfigStruct = assign(
  lovelaceCardConfigStruct,
  assign(
    entitySharedConfigStruct,
    appearanceSharedConfigStruct,
    actionsSharedConfigStruct
  ),
  object({
    icon_color: optional(string()),
    timer_enabled: optional(boolean()),
    timer_duration: optional(number()),
    motion_enabled: optional(boolean()),
    motion_sensor: optional(string()),
  })
);
