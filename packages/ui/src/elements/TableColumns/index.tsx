'use client'
import type { Field, SanitizedCollectionConfig } from 'payload/types'
import type { CellProps } from 'payload/types'

import React, { createContext, useCallback, useContext, useEffect, useReducer, useRef } from 'react'

import type { ListPreferences } from '../../views/List/types'
import type { Column } from '../Table/types'
import type { Action } from './columnReducer'

import { useComponentMap } from '../../providers/ComponentMapProvider'
import { useConfig } from '../../providers/Config'
import { usePreferences } from '../../providers/Preferences'
import { buildColumns } from './buildColumns'
import { columnReducer } from './columnReducer'

export interface ITableColumns {
  columns: Column[]
  dispatchTableColumns: React.Dispatch<Action>
  moveColumn: (args: { fromIndex: number; toIndex: number }) => void
  setActiveColumns: (columns: string[]) => void
  toggleColumn: (column: string) => void
}

export const TableColumnContext = createContext<ITableColumns>({} as ITableColumns)

export const useTableColumns = (): ITableColumns => useContext(TableColumnContext)

export const TableColumnsProvider: React.FC<{
  cellProps?: Partial<CellProps>[]
  children: React.ReactNode
  collectionSlug: string
  listPreferences: ListPreferences
}> = ({ cellProps, children, collectionSlug, listPreferences }) => {
  const config = useConfig()

  const { componentMap } = useComponentMap()

  const { fieldMap } = componentMap.collections[collectionSlug]

  const collectionConfig = config.collections.find(
    (collectionConfig) => collectionConfig.slug === collectionSlug,
  )

  const {
    admin: { defaultColumns, useAsTitle },
  } = collectionConfig

  const preferenceKey = `${collectionSlug}-list`
  const prevCollection = useRef<SanitizedCollectionConfig['slug']>(collectionSlug)
  const hasInitialized = useRef(false)
  const { getPreference, setPreference } = usePreferences()

  const [tableColumns, dispatchTableColumns] = useReducer(columnReducer, {}, () => {
    return buildColumns({
      cellProps,
      columnPreferences: listPreferences?.columns,
      defaultColumns,
      fieldMap,
      useAsTitle,
    })
  })

  // /////////////////////////////////////
  // Get preferences on collection change
  // /////////////////////////////////////

  useEffect(() => {
    const sync = async () => {
      const collectionHasChanged = prevCollection.current !== collectionSlug

      if (collectionHasChanged) {
        const currentPreferences = await getPreference<ListPreferences>(preferenceKey)
        prevCollection.current = collectionSlug

        if (currentPreferences.columns) {
          dispatchTableColumns({
            payload: {
              columns: buildColumns({
                cellProps,
                columnPreferences: currentPreferences?.columns,
                defaultColumns,
                fieldMap,
                useAsTitle,
              }),
            },
            type: 'set',
          })
        }
      }
    }

    sync()
  }, [
    preferenceKey,
    getPreference,
    collectionSlug,
    fieldMap,
    cellProps,
    defaultColumns,
    useAsTitle,
  ])

  // /////////////////////////////////////
  // Set preferences on column change
  // /////////////////////////////////////

  useEffect(() => {
    if (!hasInitialized.current) {
      hasInitialized.current = true
      return
    }

    const columns = tableColumns.map((c) => ({
      accessor: c?.accessor,
      active: c?.active,
    }))

    void setPreference(preferenceKey, { columns }, true)
  }, [tableColumns, preferenceKey, setPreference])

  // const setActiveColumns = useCallback(
  //   (columns: string[]) => {
  //     dispatchTableColumns({
  //       payload: {
  //         // onSelect,
  //         i18n,
  //         cellProps,
  //         collection: { ...collectionConfig, fields: formatFields(collectionConfig) },
  //         columns: columns.map((column) => ({
  //           accessor: column,
  //           active: true,
  //         })),
  //       },
  //       type: 'set',
  //     })
  //   },
  //   [collectionConfig, cellProps],
  // )

  const moveColumn = useCallback(
    (args: { fromIndex: number; toIndex: number }) => {
      const { fromIndex, toIndex } = args

      dispatchTableColumns({
        payload: {
          fromIndex,
          toIndex,
        },
        type: 'move',
      })
    },
    [dispatchTableColumns],
  )

  const toggleColumn = useCallback(
    (column: string) => {
      dispatchTableColumns({
        payload: {
          column,
        },
        type: 'toggle',
      })
    },
    [collectionConfig, cellProps],
  )

  return (
    <TableColumnContext.Provider
      value={{
        columns: tableColumns,
        dispatchTableColumns,
        moveColumn,
        // setActiveColumns,
        toggleColumn,
      }}
    >
      {children}
    </TableColumnContext.Provider>
  )
}