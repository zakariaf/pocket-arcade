// packages/tooling/src/storekit/ArmTests.swift
// Hosted XCTest (TEST_HOST = the app): runs SKTestSession inside the app process to arm the
// simulator StoreKit test environment for the app bundle id. Verified 2026-09-26 (Xcode 26.6).
import XCTest
import StoreKitTest

final class ArmTests: XCTestCase {
  func testArmDefault() throws {
    let s = try SKTestSession(configurationFileNamed: "Premium")
    s.disableDialogs = true
    s.clearTransactions()
    s.askToBuyEnabled = false
    s.failTransactionsEnabled = false
    s.resetToDefaultState()
    s.disableDialogs = true
    s.clearTransactions()
    print("SKSPIKE ARM default fail=\(s.failTransactionsEnabled) ask=\(s.askToBuyEnabled)")
  }
  func testArmAskToBuy() throws {
    let s = try SKTestSession(configurationFileNamed: "Premium")
    s.disableDialogs = true
    s.clearTransactions()
    s.askToBuyEnabled = true
    print("SKSPIKE ARM asktobuy")
  }
  func testArmFail() throws {
    let s = try SKTestSession(configurationFileNamed: "Premium")
    s.disableDialogs = true
    s.clearTransactions()
    s.failTransactionsEnabled = true
    print("SKSPIKE ARM fail")
  }
  func testApproveAll() throws {
    let s = try SKTestSession(configurationFileNamed: "Premium")
    let txs = s.allTransactions()
    print("SKSPIKE APPROVE txs=\(txs.map { "\($0.identifier) pending=\($0.pendingAskToBuyConfirmation) state=\($0.state.rawValue)" })")
    for t in txs where t.pendingAskToBuyConfirmation { try s.approveAskToBuyTransaction(identifier: t.identifier) }
    s.askToBuyEnabled = false
  }
  func testRefundAll() throws {
    let s = try SKTestSession(configurationFileNamed: "Premium")
    let txs = s.allTransactions()
    print("SKSPIKE REFUND txs=\(txs.map { "\($0.identifier) state=\($0.state.rawValue)" })")
    for t in txs { try s.refundTransaction(identifier: t.identifier) }
  }
}
