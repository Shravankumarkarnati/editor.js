import { ToolConfig } from "../tools";
import { BlockToolAdapter } from "../tools/adapters/block-tool-adapter";

/**
 * Describes methods for accessing installed Editor tools
 */
export interface Tools {
  /**
   * Returns all available Block Tools
   */
  getBlockTools(): BlockToolAdapter[];
  /**
   * Updates tool's config
   *
   * @param toolName name of the tool
   * @param config config of the tool
   */
  updateToolConfig(toolName: string, config: ToolConfig): void;
}
