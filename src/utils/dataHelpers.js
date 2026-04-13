/**
 * Pure utility functions for batch data management.
 */

/**
 * Returns a summary of the content (first 80 chars).
 * If content.length <= 80, returns as-is. Otherwise returns first 80 chars + '...'
 * @param {string} content
 * @returns {string}
 */
export function getSummary(content) {
  if (!content) return ''
  if (content.length <= 80) return content
  return content.slice(0, 80) + '...'
}

/**
 * Converts PapaParse result rows (array of objects) into DataItem[] structure.
 * Separates 'expected_output' field from input content if present.
 * @param {Array<Object>} parsedRows
 * @returns {Array<{id: number, content: string, expectedOutput: string, fields: Object, selected: boolean, expanded: boolean}>}
 */
export function parseCsvToDataItems(parsedRows) {
  return parsedRows.map((row, index) => {
    const expectedOutput = row.expected_output || row.expectedOutput || ''
    // Build content from all fields EXCEPT expected_output
    const inputFields = Object.entries(row).filter(([k]) => k !== 'expected_output' && k !== 'expectedOutput')
    const content = inputFields.length === 1
      ? inputFields[0][1]  // Single input field: use value directly
      : inputFields.map(([k, v]) => `${k}: ${v}`).join('\n')
    return {
      id: index + 1,
      content,
      expectedOutput,
      fields: { ...row },
      selected: true,
      expanded: false,
    }
  })
}

/**
 * Updates a DataItem's content field by id. Mutates the array in place.
 * @param {Array} csvData
 * @param {number} id
 * @param {string} newContent
 * @returns {Array}
 */
export function updateDataItem(csvData, id, newContent) {
  const item = csvData.find((item) => item.id === id)
  if (item) {
    item.content = newContent
  }
  return csvData
}

/**
 * Sets all items' selected to true.
 * @param {Array} items
 */
export function selectAll(items) {
  items.forEach((item) => { item.selected = true })
}

/**
 * Sets all items' selected to false.
 * @param {Array} items
 */
export function deselectAll(items) {
  items.forEach((item) => { item.selected = false })
}

/**
 * Returns count of items where selected === true.
 * @param {Array} items
 * @returns {number}
 */
export function getSelectedCount(items) {
  return items.filter((item) => item.selected === true).length
}

/**
 * Navigates focus up or down in the items list.
 * Collapses current item, moves index, expands new item.
 * Returns new index (unchanged if at boundary).
 * @param {Array} items
 * @param {number} currentIndex
 * @param {'up' | 'down'} direction
 * @returns {number}
 */
export function navigateFocus(items, currentIndex, direction) {
  if (direction === 'up' && currentIndex > 0) {
    items[currentIndex].expanded = false
    const newIndex = currentIndex - 1
    items[newIndex].expanded = true
    return newIndex
  }
  if (direction === 'down' && currentIndex < items.length - 1) {
    items[currentIndex].expanded = false
    const newIndex = currentIndex + 1
    items[newIndex].expanded = true
    return newIndex
  }
  return currentIndex
}

/**
 * Formats batch run progress text.
 * @param {number} completed
 * @param {number} total
 * @returns {string}
 */
export function formatProgress(completed, total) {
  return `批量运行中 ${completed}/${total}`
}

/**
 * Exports batch data (input + output results) as a CSV file download.
 * @param {Array} csvData - DataItem[] array
 * @param {Array} outputList - OutputItem[] array
 */
export function exportBatchData(csvData, outputList) {
  const rows = csvData.map((item) => {
    const output = outputList.find(o => o.id === item.id)
    return {
      ...item.fields,
      _output: output?.content || '',
      _status: output?.status || '',
      _latency: output?.latency || ''
    }
  })
  
  // Use PapaParse to generate CSV - import dynamically to avoid circular deps
  import('papaparse').then((Papa) => {
    const csv = Papa.default.unparse(rows)
    const bom = '\uFEFF'
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    const now = new Date()
    const timeStr = `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2, '0')}${now.getDate().toString().padStart(2, '0')}_${now.getHours().toString().padStart(2, '0')}${now.getMinutes().toString().padStart(2, '0')}`
    a.download = `batch-export_${timeStr}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  })
}
