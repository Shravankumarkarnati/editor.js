import BlockTool from "../../src/components/tools/block";
import { ToolConfig } from '../tools';

/**
 * Describes methods for accessing installed Editor tools
 */
export interface Tools {
  /**
   * Returns all available Block Tools
   */
  getBlockTools(): BlockTool[];

  /**
   * Updates tool's config
   *
   * @param toolName name of the tool
   * @param config config of the tool
   */
  updateToolConfig(toolName: string, config: ToolConfig): void
}
