import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';
import { Node as ProseMirrorNode } from 'prosemirror-model';
import { ClickUpTaskManager } from './use-clickup-task';

/**
 * Extension to detect and render ClickUp links with task status and name
 */
export const ClickUpLinkExtension = Extension.create({
  name: 'clickupLink',

  addOptions() {
    return {
      // Add any options here if needed
    };
  },

  addKeyboardShortcuts() {
    return {
      // Handle Backspace to delete ClickUp links
      Backspace: ({ editor }) => {
        const { state, view } = editor;
        const { selection } = state;
        
        // Only handle when we have a cursor selection
        if (!selection.empty) {
          return false;
        }
        
        // Check if cursor is positioned just after a link
        const $pos = selection.$head;
        const nodeBefore = $pos.nodeBefore;
        
        // If we have a node before cursor and it's a text node
        if (nodeBefore && nodeBefore.isText) {
          // Check if this node has link marks
          const clickUpLinkMark = nodeBefore.marks.find(mark => {
            if (mark.type.name === 'link') {
              const href = mark.attrs.href || '';
              return href.includes('app.clickup.com/t/');
            }
            return false;
          });
          
          if (clickUpLinkMark) {
            // We found a ClickUp link, delete it completely
            const from = $pos.pos - nodeBefore.nodeSize;
            const to = $pos.pos;
            
            console.log('Deleting ClickUp link:', from, to);
            
            // Create a new transaction
            const tr = state.tr.delete(from, to);
            view.dispatch(tr);
            return true;
          }
        }
        
        return false;
      }
    };
  },

  addProseMirrorPlugins() {
    const clickUpURLRegex = /https:\/\/app\.clickup\.com\/t\/([a-z0-9]+)/i;
    // Cache for task data to avoid redundant API calls
    const taskCache: Record<string, any> = {};
    
    // Store current decoration set to avoid unnecessary recomputation
    let cachedDecorations: DecorationSet | null = null;
    let lastDocVersion = 0;
    
    // Flag to track if we're currently loading tasks
    let loadingTasks = false;
    
    // List of all tasks found in the document for batch loading
    const documentTasks = new Set<string>();
    
    // Flag to force redraw of decorations after task data is loaded
    let forceRedraw = false;

    return [
      new Plugin({
        key: new PluginKey('clickupLink'),
        
        // Use decorations to render ClickUp links
        props: {
          // Create decorations for ClickUp links
          decorations: (state) => {
            const { doc } = state;
            
            // Use a fingerprint of the document to detect real changes
            // This prevents excessive re-rendering when cursor moves or selection changes
            const docFingerprint = state.doc.nodeSize + state.selection.from;
            
            // Reuse cached decorations if document hasn't meaningfully changed and we're not loading tasks
            // Also check forceRedraw flag to ensure decorations are updated after task data is loaded
            if (cachedDecorations && docFingerprint === lastDocVersion && !loadingTasks && !forceRedraw) {
              return cachedDecorations;
            }
            
            // Reset forceRedraw flag after using it
            if (forceRedraw) {
              forceRedraw = false;
            }
            
            // Update document fingerprint
            lastDocVersion = docFingerprint;
            
            const decorations: Decoration[] = [];
            documentTasks.clear();
            
            // Find all link nodes
            doc.descendants((node: ProseMirrorNode, pos: number) => {
              // Check if this node has a link mark
              const linkMark = node.marks.find(mark => mark.type.name === 'link');
              
              if (linkMark) {
                const url = linkMark.attrs.href || '';
                const taskId = ClickUpTaskManager.extractTaskId(url);
                
                // If this is a ClickUp link
                if (taskId) {
                  // Add to document tasks list for batch loading
                  documentTasks.add(taskId);
                  // Add decoration with custom rendering
                  const from = pos;
                  const to = pos + node.nodeSize;

                  // Generate the HTML for our custom ClickUp link display
                  const generateClickUpLinkHtml = (taskData: any) => {
                    const taskName = taskData?.name || 'Задача ClickUp';
                    const statusColor = taskData?.status?.color || '#ddd';
                    const statusText = taskData?.status?.status || 'Статус';
                    
                    // Get priority info and determine color
                    let priorityColor = '#999'; // default gray
                    let priorityName = '';
                    
                    // Check if priority data exists
                    if (taskData?.priority) {
                      // Get priority name if available
                      if (taskData.priority.priority) {
                        priorityName = taskData.priority.priority;
                      }
                      
                      // Get color from API if available
                      if (taskData.priority.color) {
                        priorityColor = taskData.priority.color;
                        
                        // Determine priority name based on color if name is not available
                        if (!priorityName) {
                          // Map common ClickUp priority colors to names
                          if (priorityColor === '#f50000') {
                            priorityName = 'Urgent';
                          } else if (priorityColor === '#f8ae00') {
                            priorityName = 'High';
                          } else if (priorityColor === '#6fddff') {
                            priorityName = 'Normal';
                          } else if (priorityColor === '#d8d8d8') {
                            priorityName = 'Low';
                          } else {
                            priorityName = 'Приоритет';
                          }
                        }
                      }
                    }
                    
                    // For debugging, log task data and assignees
                    console.log('ClickUp Task Data:', taskData);
                    if (taskData?.assignees) {
                      console.log('Assignees:', taskData.assignees);
                    }
                    
                    // For debugging, log assignee information
                    let assigneeNames = 'Не назначено';
                    
                    // In ClickUp API, assignees can be in different fields
                    if (taskData?.assignees && Array.isArray(taskData.assignees) && taskData.assignees.length > 0) {
                      // Try to get names from different fields in the API
                      const names = taskData.assignees
                        .filter(a => a && (a.username || a.email || a.displayName || a.name))
                        .map(a => a.username || a.email || a.displayName || a.name)
                        .filter(Boolean);
                      
                      if (names.length > 0) {
                        assigneeNames = names.join(', ');
                      }
                    } else if (taskData?.assignee) {
                      // Alternative API field
                      assigneeNames = taskData.assignee.username || 
                                    taskData.assignee.email || 
                                    taskData.assignee.displayName || 
                                    taskData.assignee.name || 
                                    'Не назначено';
                    }
                    
                    // Create HTML for priority flag
                    const priorityFlagHtml = priorityName ? `
                      <div class="clickup-tooltip-priority">
                        <span class="clickup-priority-flag" style="background-color: ${priorityColor}"></span>
                        <span>${priorityName}</span>
                      </div>
                    ` : '';
                    
                    // Create custom tooltip HTML
                    const tooltipHtml = `
                      <div class="clickup-custom-tooltip">
                        <div class="clickup-tooltip-status" style="background-color: ${statusColor}">
                          <span>${statusText}</span>
                        </div>
                        ${priorityFlagHtml}
                        ${assigneeNames !== 'Не назначено' ? `
                        <div class="clickup-tooltip-assignees">
                          <span>👤 ${assigneeNames}</span>
                        </div>
                        ` : ''}
                      </div>
                    `;
                    
                    // Create a single clickable link for the entire container
                    return `
                      <span class="clickup-link-container" data-task-id="${taskData?.id || ''}">
                        <a href="${url}" target="_blank" rel="noopener noreferrer" class="clickup-link-content">
                          <span class="clickup-task-status" style="background-color: ${statusColor}"></span>
                          <span class="clickup-task-name">${taskName}</span>
                          <span class="clickup-external-link">
                            <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" fill="none">
                              <path stroke="none" d="M0 0h24v24H0z" fill="none"/>
                              <path d="M12 6h-6a2 2 0 0 0 -2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-6" />
                              <path d="M11 13l9 -9" />
                              <path d="M15 4h5v5" />
                            </svg>
                          </span>
                        </a>
                        <div class="clickup-tooltip-wrapper">
                          ${tooltipHtml}
                        </div>
                      </span>
                    `;
                  };

                  // Check if we have task data in cache
                  if (taskCache[taskId]) {
                    // Create decoration with cached data
                    decorations.push(
                      Decoration.widget(from, () => {
                        const span = document.createElement('span');
                        span.className = 'clickup-link-widget';
                        span.innerHTML = generateClickUpLinkHtml(taskCache[taskId]);
                        span.addEventListener('click', (e) => {
                          // Handle click on external link icon
                          const target = e.target as HTMLElement;
                          if (target && (target.closest('.clickup-external-link') || target.className === 'clickup-external-link')) {
                            // Do nothing, let the link work
                          } else {
                            // Prevent default click behavior for the rest of the widget
                            e.preventDefault();
                            e.stopPropagation();
                          }
                        });
                        return span;
                      })
                    );
                    
                    // Hide the original link text
                    decorations.push(
                      Decoration.inline(from, to, {
                        class: 'clickup-link-hidden',
                      })
                    );
                  } else {
                    // We don't have data yet, show loading state and fetch data
                    decorations.push(
                      Decoration.widget(from, () => {
                        const span = document.createElement('span');
                        span.className = 'clickup-link-widget clickup-link-loading';
                        span.innerHTML = `
                          <span class="clickup-link-container">
                            <span class="clickup-task-status" style="background-color: #ddd"></span>
                            <span class="clickup-task-name">Loading task...</span>
                          </span>
                        `;
                        return span;
                      })
                    );
                    
                    // Hide the original link text
                    decorations.push(
                      Decoration.inline(from, to, {
                        class: 'clickup-link-hidden',
                      })
                    );
                    // Task loading is now handled in batch at the end of the decorations function
                    // No need to load individual tasks here, they'll be loaded in a batch
                    // This prevents multiple redraws for each task
                  }
                }
              }
              
              return true;
            });
            
            // Cache the decorations
            cachedDecorations = DecorationSet.create(doc, decorations);
            
            // If we found tasks that need to be loaded, load them in batch
            if (!loadingTasks) {
              const tasksToLoad = Array.from(documentTasks).filter(id => !taskCache[id]);
              
              if (tasksToLoad.length > 0) {
                loadingTasks = true;
                
                // Load tasks sequentially to avoid hammering the server
                const loadTasksBatch = async () => {
                  for (const taskId of tasksToLoad) {
                    try {
                      console.log('Loading task data for:', taskId);
                      // Get task data
                      const taskData = await ClickUpTaskManager.getTask(taskId);
                      // Save in cache
                      taskCache[taskId] = taskData;
                      
                      // For debugging, log task data
                      console.log('ClickUp Task Data:', taskData);
                      if (taskData && 'assignees' in taskData) {
                        console.log('Assignees:', (taskData as any).assignees);
                      }
                      // Data already fetched and logged above
                    } catch (error) {
                      console.error('[ClickUpExt] Error fetching task:', error);
                    }
                  }
                  
                  // Mark loading as complete and force one update
                  loadingTasks = false;
                  // Set flag to force redraw of decorations
                  forceRedraw = true;
                  
                  // Force redraw of decorations
                  if (this.editor) {
                    // This transaction will force the editor to redraw decorations
                    setTimeout(() => {
                      if (this.editor) {
                        this.editor.view.dispatch(this.editor.state.tr);
                        // console.log('Forcing redraw after loading all tasks');
                      }
                    }, 10); // Small delay to ensure update
                  }
                };
                
                loadTasksBatch();
              }
            }
            
            return cachedDecorations;
          },
          
          // Handle clicks on ClickUp links
          handleClick: (view, pos, event) => {
            // Check if we clicked inside our custom widget
            const target = event.target as HTMLElement;
            if (target && target.closest('.clickup-link-widget')) {
              // Let external link clicks through
              if (target.closest('.clickup-external-link')) {
                return false; // Don't prevent default for external link
              }
              return true; // Prevent default link behavior for the rest
            }
            return false;
          },
          
          // Handle keyboard events to allow deleting ClickUp links with Backspace
          handleKeyDown: (view, event) => {
            // Only handle Backspace key
            if (event.key !== 'Backspace') {
              return false;
            }
            
            const { state, dispatch } = view;
            const { selection } = state;
            const { $cursor } = selection as any;
            
            // We only care about cursor selections
            if (!$cursor) {
              return false;
            }
            
            // Check if cursor is at the beginning of a node and there's a node before it
            if ($cursor.parentOffset === 0 && $cursor.pos > 0) {
              // Try to find a link node before current position
              let foundClickUpLink = false;
              let linkPos = -1;
              let linkNode: ProseMirrorNode | null = null;
              
              // Iterate through the document to find link nodes
              state.doc.nodesBetween($cursor.pos - 1, $cursor.pos, (node, pos) => {
                // Check if this is a text node with a link mark
                const linkMark = node.marks.find(mark => mark.type.name === 'link');
                if (linkMark) {
                  const url = linkMark.attrs.href || '';
                  const taskId = ClickUpTaskManager.extractTaskId(url);
                  
                  // If this is a ClickUp link
                  if (taskId) {
                    foundClickUpLink = true;
                    linkPos = pos;
                    linkNode = node;
                    return false; // Stop iterating
                  }
                }
                return true;
              });
              
              // If we found a ClickUp link before the cursor
              if (foundClickUpLink && linkNode && linkPos >= 0) {
                const linkSize = linkNode.nodeSize;
                const from = linkPos;
                const to = linkPos + linkSize;
                
                // Delete the link node
                dispatch(state.tr.delete(from, to));
                return true; // We handled the event
              }
            }
            
            return false; // Let other handlers process the event
          }
        }
      })
    ];
  },
  
  // All necessary methods have been implemented
});

// Add CSS for ClickUp links
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    .clickup-link {
      position: relative;
    }
    
    .ProseMirror .clickup-task-card {
      display: inline-flex;
      align-items: center;
      border-radius: 4px;
      padding: 2px 8px;
      margin: 0 2px;
      background-color: rgba(0, 0, 0, 0.03);
      border: 1px solid rgba(0, 0, 0, 0.1);
      text-decoration: none !important;
    }
    
    .ProseMirror .clickup-task-status {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 6px;
    }
  `;
  document.head.appendChild(style);
}

export default ClickUpLinkExtension;
