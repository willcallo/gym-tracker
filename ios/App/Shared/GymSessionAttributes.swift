import ActivityKit
import Foundation

// The data behind the lock-screen Live Activity. Compiled into both the app (which starts and
// updates it) and the widget extension (which draws it), so the two always agree on its shape.
//
// Only dates are passed: iOS draws the ticking clocks itself, so nothing needs to update the
// activity while the phone is locked.
struct GymSessionAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        /// When the current rest ends, or nil when not resting.
        var restEndsAt: Date?
        /// Length of the current rest, for the progress bar.
        var restSeconds: Int?
    }

    /// When the session was started; the session clock counts up from here.
    var startedAt: Date
}
