import * as chai from 'chai'
const expect = chai.expect

import * as path from 'path'
import * as fs from 'fs'

import * as crypto from 'crypto'

import { GitProcess, GitError } from '../lib'

const temp = require('temp').track()

describe('git-process', () => {
  it('can launch git', async () => {
    const result = await GitProcess.exec([ '--version' ], __dirname)
    expect(result.stdout.length).to.be.greaterThan(0)
  })

  describe('exitCode', () => {
    it('returns exit code when folder is empty', async () => {
      const testRepoPath = temp.mkdirSync('desktop-git-test-blank')
      const result = await GitProcess.exec([ 'show', 'HEAD' ], testRepoPath)
      expect(result.exitCode).to.equal(128)
    })

    describe('clone', () => {
      it('returns exit code when repository doesn\'t exist', async () => {
        const testRepoPath = temp.mkdirSync('desktop-git-test-blank')
        const result = await GitProcess.exec([ 'clone', '--', '.'], testRepoPath)
        expect(result.exitCode).to.equal(128)
      })
    })

    describe('diff', () => {
      it('returns expected error code for initial commit when creating diff', async () => {
        const testRepoPath = temp.mkdirSync('desktop-git-test-blank')
        await GitProcess.exec([ 'init' ], testRepoPath)

        const file = path.join(testRepoPath, 'new-file.md')
        fs.writeFileSync(file, 'this is a new file')
        const result = await GitProcess.exec([ 'diff', '--no-index', '--patch-with-raw', '-z', '--', '/dev/null', 'new-file.md' ], testRepoPath)

        expect(result.exitCode).to.equal(1)
        expect (result.stdout.length).to.be.greaterThan(0)
      })

      it('returns expected error code for repository with history when creating diff', async () => {
        const testRepoPath = temp.mkdirSync('desktop-git-test-blank')
        await GitProcess.exec([ 'init' ], testRepoPath)

        const readme = path.join(testRepoPath, 'README.md')
        fs.writeFileSync(readme, 'hello world!')
        await GitProcess.exec([ 'add', '.' ], testRepoPath)

        const commit = await GitProcess.exec([ 'commit', '--author="Some User <some.user@email.com>"', '-F',  '-' ], testRepoPath, { stdin: 'hello world!' })
        expect(commit.exitCode).to.eq(0)

        const file = path.join(testRepoPath, 'new-file.md')
        fs.writeFileSync(file, 'this is a new file')
        const result = await GitProcess.exec([ 'diff', '--no-index', '--patch-with-raw', '-z', '--', '/dev/null', 'new-file.md' ], testRepoPath)
        expect(result.exitCode).to.equal(1)
        expect(result.stdout.length).to.be.greaterThan(0)
      })

      it('throws error when exceeding the output range', async () => {
        const testRepoPath = temp.mkdirSync('desktop-git-test-blank')
        await GitProcess.exec([ 'init' ], testRepoPath)

        // NOTE: if we change the default buffer size in git-process
        // this test may no longer fail as expected - see https://git.io/v1dq3
        const output = crypto.randomBytes(10*1024*1024).toString('hex')
        const file = path.join(testRepoPath, 'new-file.md')
        fs.writeFileSync(file, output)

        let throws = false
        try {
          await GitProcess.exec([ 'diff', '--no-index', '--patch-with-raw', '-z', '--', '/dev/null', 'new-file.md' ], testRepoPath)
        } catch (e) {
          throws = true
        }
        expect(throws).to.be.true
      })
    })
  })

  describe('errors', () => {
    it('raises error when folder does not exist', async () => {
      const testRepoPath = path.join(temp.path(), 'desktop-does-not-exist')

      let error: Error | null = null
      try {
        await GitProcess.exec([ 'show', 'HEAD' ], testRepoPath)
      } catch (e) {
        error = e
      }

      expect(error!.message).to.equal('Unable to find path to repository on disk.')
    })

    it('can parse errors', () => {
      const error = GitProcess.parseError('fatal: Authentication failed')
      expect(error).to.equal(GitError.SSHAuthenticationFailed)
    })

    it('can parse bad revision errors', () => {
      const error = GitProcess.parseError("fatal: bad revision 'beta..origin/beta'")
      expect(error).to.equal(GitError.BadRevision)
    })
  })
})
