/*
 * @japa/run-failed-tests
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { join } from 'path'
import { PluginFn } from '@japa/runner'
import findCacheDir from 'find-cache-dir'
import { sticker } from '@poppinss/cliui'
import { outputJson, readJson } from 'fs-extra'

/**
 * Returns the summary from the summary file
 */
async function getSummary(summaryFilePath: string): Promise<{ tests?: string[] }> {
  try {
    return await readJson(summaryFilePath)
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {}
    }
    throw new Error(`"@japa/run-failed-tests": ${error.message}`)
  }
}

/**
 * Perists summary with failing tests to the disk
 */
async function writeSummary(
  summaryFilePath: string,
  contents: { tests?: string[] }
): Promise<void> {
  await outputJson(summaryFilePath, contents)
}

/**
 * Plugin function to run failed tests only. Only for "@japa/runner"
 */
export function runFailedTests(options?: {
  summaryFilePath?: string
  ignoreFilesFilter?: boolean
}): PluginFn {
  options = Object.assign({}, options)

  return async function (config) {
    /**
     * Do not overwrite existing filters
     */
    if (config.filters.tests?.length) {
      return
    }

    /**
     * Use the default path when no explicit path is provided
     */
    if (!options!.summaryFilePath) {
      options!.summaryFilePath = join(
        findCacheDir({ name: '@japa/run-failed-tests' }, 'summary.json')
      )
    }

    /**
     * Get summary and look for failed tests
     */
    const summary = await getSummary(options!.summaryFilePath)

    /**
     * Apply the filter when there are one or more failed tests
     */
    if (summary.tests?.length) {
      config.filters.tests = summary.tests

      sticker()
        .heading('"@japa/run-failed-tests"')
        .add('')
        .add(`${summary.tests.length} failed test(s) found`)
        .add('Applying filter to run only failed tests')
        .render()

      /**
       * Empty out files filter when "ignoreFilesFilter" is set to true
       */
      if (options!.ignoreFilesFilter) {
        config.filters.files = []
      }
    }

    /**
     * Persist file during teardown
     */
    config.teardown.push(async (runner) => {
      await writeSummary(options!.summaryFilePath!, {
        tests: runner.getSummary().failedTestsTitles,
      })
    })
  }
}
