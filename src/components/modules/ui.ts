/* eslint-disable jsdoc/no-undefined-types */
/**
 * Module UI
 *
 * @type {UI}
 */
import Module from '../__module';
import $, { toggleEmptyMark } from '../dom';
import * as _ from '../utils';

import Selection from '../selection';
import Block from '../block';
import Flipper from '../flipper';
import { mobileScreenBreakpoint } from '../utils';

import styles from '../../styles/main.css?inline';
import { BlockHovered } from '../events/BlockHovered';
import { selectionChangeDebounceTimeout } from '../constants';
import { EditorMobileLayoutToggled } from '../events';
/**
 * HTML Elements used for UI
 */
interface UINodes {
  holder: HTMLElement;
  wrapper: HTMLElement;
  redactor: HTMLElement;
}

/**
 * @class
 * @classdesc Makes Editor.js UI:
 *                <codex-editor>
 *                    <ce-redactor />
 *                    <ce-toolbar />
 *                    <ce-inline-toolbar />
 *                </codex-editor>
 * @typedef {UI} UI
 * @property {EditorConfig} config   - editor configuration {@link EditorJS#configuration}
 * @property {object} Editor         - available editor modules {@link EditorJS#moduleInstances}
 * @property {object} nodes          -
 * @property {Element} nodes.holder  - element where we need to append redactor
 * @property {Element} nodes.wrapper  - <codex-editor>
 * @property {Element} nodes.redactor - <ce-redactor>
 */
export default class UI extends Module<UINodes> {
  /**
   * Editor.js UI CSS class names
   *
   * @returns {{editorWrapper: string, editorZone: string}}
   */
  public get CSS(): {
    editorWrapper: string; editorWrapperNarrow: string; editorZone: string; editorZoneHidden: string;
    editorEmpty: string; editorRtlFix: string;
    } {
    return {
      editorWrapper: 'codex-editor',
      editorWrapperNarrow: 'codex-editor--narrow',
      editorZone: 'codex-editor__redactor',
      editorZoneHidden: 'codex-editor__redactor--hidden',
      editorEmpty: 'codex-editor--empty',
      editorRtlFix: 'codex-editor--rtl',
    };
  }

  /**
   * Return Width of center column of Editor
   *
   * @returns {DOMRect}
   */
  public get contentRect(): DOMRect {
    if (this.contentRectCache) {
      return this.contentRectCache;
    }

    const someBlock = this.nodes.wrapper.querySelector(`.${Block.CSS.content}`);

    /**
     * When Editor is not ready, there is no Blocks, so return the default value
     */
    if (!someBlock) {
      return {
        width: 650,
        left: 0,
        right: 0,
      } as DOMRect;
    }

    this.contentRectCache = someBlock.getBoundingClientRect() as DOMRect;

    return this.contentRectCache;
  }

  /**
   * Flag that became true on mobile viewport
   *
   * @type {boolean}
   */
  public isMobile = false;


  /**
   * Cache for center column rectangle info
   * Invalidates on window resize
   *
   * @type {DOMRect}
   */
  private contentRectCache: DOMRect = undefined;

  /**
   * Handle window resize only when it finished
   *
   * @type {() => void}
   */
  private resizeDebouncer: () => void = _.debounce(() => {
    this.windowResize();
  // eslint-disable-next-line @typescript-eslint/no-magic-numbers
  }, 200);

  /**
   * Making main interface
   */
  public async prepare(): Promise<void> {
    /**
     * Detect mobile version
     */
    this.setIsMobile();

    /**
     * Make main UI elements
     */
    this.make();

    /**
     * Load and append CSS
     */
    this.loadStyles();
  }


  /**
   * Toggle read-only state
   *
   * If readOnly is true:
   *  - removes all listeners from main UI module elements
   *
   * if readOnly is false:
   *  - enables all listeners to UI module elements
   *
   * @param {boolean} readOnlyEnabled - "read only" state
   */
  public toggleReadOnly(readOnlyEnabled: boolean): void {
    /**
     * Prepare components based on read-only state
     */
    if (!readOnlyEnabled) {
      /**
       * Postpone events binding to the next tick to make sure all ui elements are ready
       */
      window.requestIdleCallback(() => {
        /**
         * Bind events for the UI elements
         */
        this.enableModuleBindings();
      }, {
        timeout: 2000,
      });
    } else {
      /**
       * Unbind all events
       *
       */
      this.disableModuleBindings();
    }
  }

  /**
   * Check if Editor is empty and set CSS class to wrapper
   */
  public checkEmptiness(): void {
    const { BlockManager } = this.Editor;

    this.nodes.wrapper.classList.toggle(this.CSS.editorEmpty, BlockManager.isEditorEmpty);
  }

  /**
   * Check if one of Toolbar is opened
   * Used to prevent global keydowns (for example, Enter) conflicts with Enter-on-toolbar
   *
   * @returns {boolean}
   */
  public get someToolbarOpened(): boolean {
    const { Toolbar, BlockSettings, InlineToolbar } = this.Editor;

    return Boolean(BlockSettings.opened || InlineToolbar.opened || Toolbar.toolbox.opened);
  }

  /**
   * Check for some Flipper-buttons is under focus
   */
  public get someFlipperButtonFocused(): boolean {
    /**
     * Toolbar has internal module (Toolbox) that has own Flipper,
     * so we check it manually
     */
    if (this.Editor.Toolbar.toolbox.hasFocus()) {
      return true;
    }

    /* eslint-disable @typescript-eslint/no-unused-vars, no-unused-vars */
    return Object.entries(this.Editor).filter(([_moduleName, moduleClass]) => {
      return moduleClass.flipper instanceof Flipper;
    })
      .some(([_moduleName, moduleClass]) => {
        return moduleClass.flipper.hasFocus();
      });

    /* eslint-enable @typescript-eslint/no-unused-vars, no-unused-vars */
  }

  /**
   * Clean editor`s UI
   */
  public destroy(): void {
    this.nodes.holder.innerHTML = '';
  }

  /**
   * Close all Editor's toolbars
   */
  public closeAllToolbars(): void {
    const { Toolbar, BlockSettings, InlineToolbar } = this.Editor;

    BlockSettings.close();
    InlineToolbar.close();
    Toolbar.toolbox.close();
  }

  /**
   * Check for mobile mode and save the result
   */
  private setIsMobile(): void {
    const isMobile = window.innerWidth < mobileScreenBreakpoint;

    if (isMobile !== this.isMobile) {
      /**
       * Dispatch global event
       */
      this.eventsDispatcher.emit(EditorMobileLayoutToggled, {
        isEnabled: this.isMobile,
      });
    }

    this.isMobile = isMobile;
  }

  /**
   * Makes Editor.js interface
   */
  private make(): void {
    /**
     * Element where we need to append Editor.js
     *
     * @type {Element}
     */
    this.nodes.holder = $.getHolder(this.config.holder);

    /**
     * Create and save main UI elements
     */
    this.nodes.wrapper = $.make('div', [
      this.CSS.editorWrapper,
      ...(this.isRtl ? [ this.CSS.editorRtlFix ] : []),
    ]);
    this.nodes.redactor = $.make('div', this.CSS.editorZone);

    /**
     * If Editor has injected into the narrow container, enable Narrow Mode
     *
     * @todo Forced layout. Get rid of this feature
     */
    if (this.nodes.holder.offsetWidth < this.contentRect.width) {
      this.nodes.wrapper.classList.add(this.CSS.editorWrapperNarrow);
    }

    /**
     * Set customizable bottom zone height
     */
    this.nodes.redactor.style.paddingBottom = this.config.minHeight + 'px';

    this.nodes.wrapper.appendChild(this.nodes.redactor);
    this.nodes.holder.appendChild(this.nodes.wrapper);
  }

  /**
   * Appends CSS
   */
  private loadStyles(): void {
    /**
     * Load CSS
     */
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const styleTagId = 'editor-js-styles';

    /**
     * Do not append styles again if they are already on the page
     */
    if ($.get(styleTagId)) {
      return;
    }

    /**
     * Make tag
     */
    const tag = $.make('style', null, {
      id: styleTagId,
      textContent: styles.toString(),
    });

    /**
     * If user enabled Content Security Policy, he can pass nonce through the config
     *
     * @see https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/nonce
     */
    if (this.config.style && !_.isEmpty(this.config.style) && this.config.style.nonce) {
      tag.setAttribute('nonce', this.config.style.nonce);
    }

    /**
     * Append styles at the top of HEAD tag
     */
    $.prepend(document.head, tag);
  }

  /**
   * Bind events on the Editor.js interface
   */
  private enableModuleBindings(): void {
    this.readOnlyMutableListeners.on(this.nodes.redactor, 'click', (event: MouseEvent) => {
      this.redactorClicked(event);
    }, false);

    this.readOnlyMutableListeners.on(this.nodes.redactor, 'mousedown', (event: MouseEvent | TouchEvent) => {
      this.documentTouched(event);
    }, {
      capture: true,
      passive: true,
    });

    this.readOnlyMutableListeners.on(this.nodes.redactor, 'touchstart', (event: MouseEvent | TouchEvent) => {
      this.documentTouched(event);
    }, {
      capture: true,
      passive: true,
    });

    this.readOnlyMutableListeners.on(document, 'keydown', (event: KeyboardEvent) => {
      this.documentKeydown(event);
    }, true);

    this.readOnlyMutableListeners.on(document, 'mousedown', (event: MouseEvent) => {
      this.documentClicked(event);
    }, true);

    /**
     * Handle selection change to manipulate Inline Toolbar appearance
     */
    const selectionChangeDebounced = _.debounce(() => {
      this.selectionChanged();
    }, selectionChangeDebounceTimeout);

    this.readOnlyMutableListeners.on(document, 'selectionchange', selectionChangeDebounced, true);

    this.readOnlyMutableListeners.on(window, 'resize', () => {
      this.resizeDebouncer();
    }, {
      passive: true,
    });

    /**
     * Start watching 'block-hovered' events that is used by Toolbar for moving
     */
    this.watchBlockHoveredEvents();

    /**
     * We have custom logic for providing placeholders for contenteditable elements.
     * To make it work, we need to have data-empty mark on empty inputs.
     */
    this.enableInputsEmptyMark();
  }


  /**
   * Listen redactor mousemove to emit 'block-hovered' event
   */
  private watchBlockHoveredEvents(): void {
    /**
     * Used to not emit the same block multiple times to the 'block-hovered' event on every mousemove
     */
    let blockHoveredEmitted;

    this.readOnlyMutableListeners.on(this.nodes.redactor, 'mousemove', _.throttle((event: MouseEvent | TouchEvent) => {
      const hoveredBlock = (event.target as Element).closest('.ce-block');

      /**
       * Do not trigger 'block-hovered' for cross-block selection
       */
      if (this.Editor.BlockSelection.anyBlockSelected) {
        return;
      }

      if (!hoveredBlock) {
        return;
      }

      if (blockHoveredEmitted === hoveredBlock) {
        return;
      }

      blockHoveredEmitted = hoveredBlock;

      this.eventsDispatcher.emit(BlockHovered, {
        block: this.Editor.BlockManager.getBlockByChildNode(hoveredBlock),
      });
    // eslint-disable-next-line @typescript-eslint/no-magic-numbers
    }, 20), {
      passive: true,
    });
  }

  /**
   * Unbind events on the Editor.js interface
   */
  private disableModuleBindings(): void {
    this.readOnlyMutableListeners.clearAll();
  }

  /**
   * Resize window handler
   */
  private windowResize(): void {
    /**
     * Invalidate content zone size cached, because it may be changed
     */
    this.contentRectCache = null;

    /**
     * Detect mobile version
     */
    this.setIsMobile();
  }

  /**
   * All keydowns on document
   *
   * @param {KeyboardEvent} event - keyboard event
   */
  private documentKeydown(event: KeyboardEvent): void {
    switch (event.keyCode) {
      case _.keyCodes.ENTER:
        this.enterPressed(event);
        break;

      case _.keyCodes.BACKSPACE:
      case _.keyCodes.DELETE:
        this.backspacePressed(event);
        break;

      case _.keyCodes.ESC:
        this.escapePressed(event);
        break;

      default:
        this.defaultBehaviour(event);
        break;
    }
  }

  /**
   * Ignore all other document's keydown events
   *
   * @param {KeyboardEvent} event - keyboard event
   */
  private defaultBehaviour(event: KeyboardEvent): void {
    const { currentBlock } = this.Editor.BlockManager;
    const keyDownOnEditor = (event.target as HTMLElement).closest(`.${this.CSS.editorWrapper}`);
    const isMetaKey = event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;

    /**
     * When some block is selected, but the caret is not set inside the editor, treat such keydowns as keydown on selected block.
     */
    if (currentBlock !== undefined && keyDownOnEditor === null) {
      this.Editor.BlockEvents.keydown(event);

      return;
    }

    /**
     * Ignore keydowns on editor and meta keys
     */
    if (keyDownOnEditor || (currentBlock && isMetaKey)) {
      return;
    }

    /**
     * Remove all highlights and remove caret
     */
    this.Editor.BlockManager.unsetCurrentBlock();

    /**
     * Close Toolbar
     */
    this.Editor.Toolbar.close();
  }

  /**
   * @param {KeyboardEvent} event - keyboard event
   */
  private backspacePressed(event: KeyboardEvent): void {
    const { BlockManager, BlockSelection, Caret } = this.Editor;

    /**
     * If any block selected and selection doesn't exists on the page (that means no other editable element is focused),
     * remove selected blocks
     */
    if (BlockSelection.anyBlockSelected && !Selection.isSelectionExists) {
      const selectionPositionIndex = BlockManager.removeSelectedBlocks();

      const newBlock = BlockManager.insertDefaultBlockAtIndex(selectionPositionIndex, true);

      Caret.setToBlock(newBlock, Caret.positions.START);

      /** Clear selection */
      BlockSelection.clearSelection(event);

      /**
       * Stop propagations
       * Manipulation with BlockSelections is handled in global backspacePress because they may occur
       * with CMD+A or RectangleSelection and they can be handled on document event
       */
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
    }
  }

  /**
   * Escape pressed
   * If some of Toolbar components are opened, then close it otherwise close Toolbar
   *
   * @param {Event} event - escape keydown event
   */
  private escapePressed(event): void {
    /**
     * Clear blocks selection by ESC
     */
    this.Editor.BlockSelection.clearSelection(event);

    if (this.Editor.Toolbar.toolbox.opened) {
      this.Editor.Toolbar.toolbox.close();
      this.Editor.Caret.setToBlock(this.Editor.BlockManager.currentBlock, this.Editor.Caret.positions.END);
    } else if (this.Editor.BlockSettings.opened) {
      this.Editor.BlockSettings.close();
    } else if (this.Editor.InlineToolbar.opened) {
      this.Editor.InlineToolbar.close();
    } else {
      this.Editor.Toolbar.close();
    }
  }

  /**
   * Enter pressed on document
   *
   * @param {KeyboardEvent} event - keyboard event
   */
  private enterPressed(event: KeyboardEvent): void {
    const { BlockManager, BlockSelection } = this.Editor;

    if (this.someToolbarOpened) {
      return;
    }

    const hasPointerToBlock = BlockManager.currentBlockIndex >= 0;

    /**
     * If any block selected and selection doesn't exists on the page (that means no other editable element is focused),
     * remove selected blocks
     */
    if (BlockSelection.anyBlockSelected && !Selection.isSelectionExists) {
      /** Clear selection */
      BlockSelection.clearSelection(event);

      /**
       * Stop propagations
       * Manipulation with BlockSelections is handled in global enterPress because they may occur
       * with CMD+A or RectangleSelection
       */
      event.preventDefault();
      event.stopImmediatePropagation();
      event.stopPropagation();

      return;
    }

    /**
     * If Caret is not set anywhere, event target on Enter is always Element that we handle
     * In our case it is document.body
     *
     * So, BlockManager points some Block and Enter press is on Body
     * We can create a new block
     */
    if (!this.someToolbarOpened && hasPointerToBlock && (event.target as HTMLElement).tagName === 'BODY') {
      /**
       * Insert the default typed Block
       */
      const newBlock = this.Editor.BlockManager.insert();

      /**
       * Prevent default enter behaviour to prevent adding a new line (<div><br></div>) to the inserted block
       */
      event.preventDefault();
      this.Editor.Caret.setToBlock(newBlock);

      /**
       * Move toolbar and show plus button because new Block is empty
       */
      this.Editor.Toolbar.moveAndOpen(newBlock);
    }

    this.Editor.BlockSelection.clearSelection(event);
  }

  /**
   * All clicks on document
   *
   * @param {MouseEvent} event - Click event
   */
  private documentClicked(event: MouseEvent): void {
    /**
     * Sometimes we emulate click on some UI elements, for example by Enter on Block Settings button
     * We don't need to handle such events, because they handled in other place.
     */
    if (!event.isTrusted) {
      return;
    }
    /**
     * Close Inline Toolbar when nothing selected
     * Do not fire check on clicks at the Inline Toolbar buttons
     */
    const target = event.target as HTMLElement;
    const clickedInsideOfEditor = this.nodes.holder.contains(target) || Selection.isAtEditor;

    if (!clickedInsideOfEditor) {
      /**
       * Clear pointer on BlockManager
       *
       * Current page might contain several instances
       * Click between instances MUST clear focus, pointers and close toolbars
       */
      this.Editor.BlockManager.unsetCurrentBlock();
      this.Editor.Toolbar.close();
    }

    /**
     * If Block Settings opened, close them by click on document.
     *
     * But allow clicking inside Block Settings.
     * Also, do not process clicks on the Block Settings Toggler, because it has own click listener
     */
    const isClickedInsideBlockSettings = this.Editor.BlockSettings.nodes.wrapper?.contains(target);
    const isClickedInsideBlockSettingsToggler = this.Editor.Toolbar.nodes.settingsToggler?.contains(target);
    const doNotProcess = isClickedInsideBlockSettings || isClickedInsideBlockSettingsToggler;

    if (this.Editor.BlockSettings.opened && !doNotProcess) {
      this.Editor.BlockSettings.close();

      const clickedBlock = this.Editor.BlockManager.getBlockByChildNode(target);

      this.Editor.Toolbar.moveAndOpen(clickedBlock);
    }

    /**
     * Clear Selection if user clicked somewhere
     */
    this.Editor.BlockSelection.clearSelection(event);
  }

  /**
   * First touch on editor
   * Fired before click
   *
   * Used to change current block — we need to do it before 'selectionChange' event.
   * Also:
   * - Move and show the Toolbar
   * - Set a Caret
   *
   * @param {MouseEvent | TouchEvent} event - touch or mouse event
   */
  private documentTouched(event: MouseEvent | TouchEvent): void {
    let clickedNode = event.target as HTMLElement;

    /**
     * If click was fired on Editor`s wrapper, try to get clicked node by elementFromPoint method
     */
    if (clickedNode === this.nodes.redactor) {
      const clientX = event instanceof MouseEvent ? event.clientX : event.touches[0].clientX;
      const clientY = event instanceof MouseEvent ? event.clientY : event.touches[0].clientY;

      clickedNode = document.elementFromPoint(clientX, clientY) as HTMLElement;
    }

    /**
     * Select clicked Block as Current
     */
    try {
      this.Editor.BlockManager.setCurrentBlockByChildNode(clickedNode);
    } catch (e) {
      /**
       * If clicked outside first-level Blocks and it is not RectSelection, set Caret to the last empty Block
       */
      if (!this.Editor.RectangleSelection.isRectActivated()) {
        this.Editor.Caret.setToTheLastBlock();
      }
    }

    /**
     * Move and open toolbar
     * (used for showing Block Settings toggler after opening and closing Inline Toolbar)
     */
    this.Editor.Toolbar.moveAndOpen();
  }

  /**
   * All clicks on the redactor zone
   *
   * @param {MouseEvent} event - click event
   * @description
   * - By clicks on the Editor's bottom zone:
   *      - if last Block is empty, set a Caret to this
   *      - otherwise, add a new empty Block and set a Caret to that
   */
  private redactorClicked(event: MouseEvent): void {
    if (!Selection.isCollapsed) {
      return;
    }

    /**
     * case when user clicks on anchor element
     * if it is clicked via ctrl key, then we open new window with url
     */
    const element = event.target as Element;
    const ctrlKey = event.metaKey || event.ctrlKey;

    if ($.isAnchor(element) && ctrlKey) {
      event.stopImmediatePropagation();
      event.stopPropagation();

      const href = element.getAttribute('href');
      const validUrl = _.getValidUrl(href);

      _.openTab(validUrl);

      return;
    }

    this.processBottomZoneClick(event);
  }

  /**
   * Check if user clicks on the Editor's bottom zone:
   *  - set caret to the last block
   *  - or add new empty block
   *
   * @param event - click event
   */
  private processBottomZoneClick(event: MouseEvent): void {
    const lastBlock = this.Editor.BlockManager.getBlockByIndex(-1);

    const lastBlockBottomCoord = $.offset(lastBlock.holder).bottom;
    const clickedCoord = event.pageY;
    const { BlockSelection } = this.Editor;
    const isClickedBottom = event.target instanceof Element &&
      event.target.isEqualNode(this.nodes.redactor) &&
      /**
       * If there is cross block selection started, target will be equal to redactor so we need additional check
       */
      !BlockSelection.anyBlockSelected &&

      /**
       * Prevent caret jumping (to last block) when clicking between blocks
       */
      lastBlockBottomCoord < clickedCoord;

    if (isClickedBottom) {
      event.stopImmediatePropagation();
      event.stopPropagation();

      const { BlockManager, Caret, Toolbar } = this.Editor;

      /**
       * Insert a default-block at the bottom if:
       * - last-block is not a default-block (Text)
       *   to prevent unnecessary tree-walking on Tools with many nodes (for ex. Table)
       * - Or, default-block is not empty
       */
      if (!BlockManager.lastBlock.tool.isDefault || !BlockManager.lastBlock.isEmpty) {
        BlockManager.insertAtEnd();
      }

      /**
       * Set the caret and toolbar to empty Block
       */
      Caret.setToTheLastBlock();
      Toolbar.moveAndOpen(BlockManager.lastBlock);
    }
  }

  /**
   * Handle selection changes on mobile devices
   * Uses for showing the Inline Toolbar
   */
  private selectionChanged(): void {
    const { CrossBlockSelection, BlockSelection } = this.Editor;
    const focusedElement = Selection.anchorElement;

    if (CrossBlockSelection.isCrossBlockSelectionStarted) {
      // Removes all ranges when any Block is selected
      if (BlockSelection.anyBlockSelected) {
        Selection.get().removeAllRanges();
      }
    }

    /**
     * Usual clicks on some controls, for example, Block Tunes Toggler
     */
    if (!focusedElement) {
      /**
       * If there is no selected range, close inline toolbar
       *
       * @todo Make this method more straightforward
       */
      if (!Selection.range) {
        this.Editor.InlineToolbar.close();
      }

      return;
    }

    /**
     * Event can be fired on clicks at non-block-content elements,
     * for example, at the Inline Toolbar or some Block Tune element
     */
    const clickedOutsideBlockContent = focusedElement.closest(`.${Block.CSS.content}`) === null;

    if (clickedOutsideBlockContent) {
      /**
       * If new selection is not on Inline Toolbar, we need to close it
       */
      if (!this.Editor.InlineToolbar.containsNode(focusedElement)) {
        this.Editor.InlineToolbar.close();
      }

      /**
       * Case when we click on external tool elements,
       * for example some Block Tune element.
       * If this external content editable element has data-inline-toolbar="true"
       */
      const inlineToolbarEnabledForExternalTool = (focusedElement as HTMLElement).dataset.inlineToolbar === 'true';

      if (!inlineToolbarEnabledForExternalTool) {
        return;
      }
    }

    /**
     * Set current block when entering to Editor.js by tab key
     */
    if (!this.Editor.BlockManager.currentBlock) {
      this.Editor.BlockManager.setCurrentBlockByChildNode(focusedElement);
    }

    this.Editor.InlineToolbar.tryToShow(true);
  }

  /**
   * Editor.js provides and ability to show placeholders for empty contenteditable elements
   *
   * This method watches for input and focus events and toggles 'data-empty' attribute
   * to workaroud the case, when inputs contains only <br>s and has no visible content
   * Then, CSS could rely on this attribute to show placeholders
   */
  private enableInputsEmptyMark(): void {
    /**
     * Toggle data-empty attribute on input depending on its emptiness
     *
     * @param event - input or focus event
     */
    function handleInputOrFocusChange(event: Event): void {
      const input = event.target as HTMLElement;

      toggleEmptyMark(input);
    }

    this.readOnlyMutableListeners.on(this.nodes.wrapper, 'input', handleInputOrFocusChange);
    this.readOnlyMutableListeners.on(this.nodes.wrapper, 'focusin', handleInputOrFocusChange);
    this.readOnlyMutableListeners.on(this.nodes.wrapper, 'focusout', handleInputOrFocusChange);
  }
}
