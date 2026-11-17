import ActivityKit
import Capacitor
import Foundation
import os
import UserNotifications

private let log = Logger(subsystem: "com.willcallo.gymtracker", category: "GymTimer")

// Bridge from the website (lib/native.ts) to the lock-screen Live Activity and the end-of-rest
// notification. Three calls:
//   start({ startedAt })                 a session is open; show its clock on the lock screen
//   update({ restEndsAt, restSeconds })  a rest started or changed (both null when it is over)
//   end()                                the session was saved or discarded
// Times are milliseconds since 1970, as JavaScript's Date.now() gives them.
@objc(GymTimerPlugin)
public class GymTimerPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "GymTimerPlugin"
    public let jsName = "GymTimer"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "start", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "end", returnType: CAPPluginReturnPromise),
    ]

    private static let restNotificationId = "rest-over"

    @objc func start(_ call: CAPPluginCall) {
        guard let ms = call.getDouble("startedAt") else {
            call.reject("startedAt is required")
            return
        }
        let startedAt = Date(timeIntervalSince1970: ms / 1000)
        log.notice("start: session started \(startedAt, privacy: .public)")
        // Asked once, the first time a session is opened, so the end-of-rest alert can sound.
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .sound]) { granted, _ in
            log.notice("notifications allowed: \(granted, privacy: .public)")
        }
        SessionActivity.enqueue { await SessionActivity.start(startedAt: startedAt) } then: { call.resolve() }
    }

    @objc func update(_ call: CAPPluginCall) {
        let restEndsAt = call.getDouble("restEndsAt").map { Date(timeIntervalSince1970: $0 / 1000) }
        let restSeconds = call.getInt("restSeconds")
        log.notice("update: rest ends \(String(describing: restEndsAt), privacy: .public)")
        scheduleRestNotification(at: restEndsAt)
        SessionActivity.enqueue { await SessionActivity.setRest(endsAt: restEndsAt, seconds: restSeconds) } then: { call.resolve() }
    }

    @objc func end(_ call: CAPPluginCall) {
        log.notice("end")
        scheduleRestNotification(at: nil)
        SessionActivity.enqueue { await SessionActivity.end() } then: { call.resolve() }
    }

    // A web page cannot make a sound on a locked phone, so the alert at the end of a rest is a
    // local notification. It only shows when the app is in the background: in the foreground the
    // website's own beep plays instead.
    private func scheduleRestNotification(at date: Date?) {
        let center = UNUserNotificationCenter.current()
        center.removePendingNotificationRequests(withIdentifiers: [Self.restNotificationId])
        center.removeDeliveredNotifications(withIdentifiers: [Self.restNotificationId])
        guard let date, date.timeIntervalSinceNow > 0.5 else { return }
        let content = UNMutableNotificationContent()
        content.title = "Rest over"
        content.body = "Time for your next set."
        content.sound = .default
        let trigger = UNTimeIntervalNotificationTrigger(timeInterval: date.timeIntervalSinceNow, repeats: false)
        center.add(UNNotificationRequest(identifier: Self.restNotificationId, content: content, trigger: trigger))
    }
}

// There is only ever one session activity. It lives on after the app is closed, so it is always
// looked up from ActivityKit rather than kept in a variable.
enum SessionActivity {
    private static var all: [Activity<GymSessionAttributes>] { Activity<GymSessionAttributes>.activities }

    // Calls from the page can arrive together (React runs effects twice in development, a save
    // ends the rest and the session at once). Each waits for the one before, so two starts can
    // never both create an activity.
    private static let lock = NSLock()
    private static var tail: Task<Void, Never>?

    static func enqueue(_ work: @escaping () async -> Void, then done: @escaping () -> Void) {
        lock.lock()
        defer { lock.unlock() }
        let previous = tail
        tail = Task {
            await previous?.value
            await work()
            done()
        }
    }

    static func start(startedAt: Date) async {
        let active = all.filter { $0.activityState == .active }
        // Same session as the one already showing (the form was reopened): leave it alone.
        if active.count == 1, abs(active[0].attributes.startedAt.timeIntervalSince(startedAt)) < 1 {
            return
        }
        await end()
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            log.notice("Live Activities are switched off for this app")
            return
        }
        do {
            let state = GymSessionAttributes.ContentState(restEndsAt: nil, restSeconds: nil)
            let activity = try Activity.request(
                attributes: GymSessionAttributes(startedAt: startedAt),
                content: ActivityContent(state: state, staleDate: nil),
                pushType: nil
            )
            log.notice("Live Activity started: \(activity.id, privacy: .public)")
        } catch {
            log.error("Live Activity could not start: \(error.localizedDescription, privacy: .public)")
        }
    }

    static func setRest(endsAt: Date?, seconds: Int?) async {
        guard let activity = all.first(where: { $0.activityState == .active }) else { return }
        let state = GymSessionAttributes.ContentState(restEndsAt: endsAt, restSeconds: seconds)
        // Marked stale when the rest runs out, which redraws it as "Rest over" with the app asleep.
        await activity.update(ActivityContent(state: state, staleDate: endsAt))
    }

    static func end() async {
        for activity in all {
            await activity.end(nil, dismissalPolicy: .immediate)
        }
    }
}
