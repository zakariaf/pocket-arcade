#!/bin/sh
# Wrong: a simulator without the e07- prefix can be cleaned up by another agent, or clean up theirs.
UDID=$(xcrun simctl create "Parity Phone" "iPhone 17 Pro" com.apple.CoreSimulator.SimRuntime.iOS-26-5)
xcrun simctl bootstatus "$UDID" -b
