import ActivityKit
import SwiftUI
import WidgetKit

// The lock-screen and Dynamic Island view of a session in progress. Every clock here is drawn
// and ticked by iOS from the dates in the activity, so it keeps running with the app asleep.

private let brand = Color(red: 0 / 255, green: 146 / 255, blue: 118 / 255) // #009276, as on the website

// Counts up from the start of the session. On the lock screen iOS may show a long-running clock
// without seconds ("12 minutes"); the rest countdown, being short, keeps its seconds.
private struct SessionClock: View {
    let startedAt: Date

    var body: some View {
        Text(startedAt, style: .timer)
    }
}

private struct Rest {
    let range: ClosedRange<Date>

    init?(_ state: GymSessionAttributes.ContentState) {
        guard let end = state.restEndsAt else { return nil }
        let seconds = Double(max(1, state.restSeconds ?? 60))
        range = end.addingTimeInterval(-seconds)...end
    }
}

struct GymSessionLiveActivity: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: GymSessionAttributes.self) { context in
            LockScreenView(context: context)
                .activityBackgroundTint(Color.black.opacity(0.75))
                .activitySystemActionForegroundColor(.white)
        } dynamicIsland: { context in
            let rest = Rest(context.state)
            let restOver = rest != nil && context.isStale
            return DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text("Session").font(.caption).foregroundStyle(.secondary)
                        SessionClock(startedAt: context.attributes.startedAt)
                            .font(.title3.weight(.semibold))
                            .monospacedDigit()
                    }
                    .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    if let rest {
                        VStack(alignment: .trailing, spacing: 2) {
                            Text(restOver ? "Rest over" : "Rest").font(.caption).foregroundStyle(brand)
                            if !restOver {
                                Text(timerInterval: rest.range, countsDown: true)
                                    .font(.title3.weight(.semibold))
                                    .monospacedDigit()
                                    .multilineTextAlignment(.trailing)
                            }
                        }
                        .padding(.trailing, 4)
                    }
                }
                DynamicIslandExpandedRegion(.bottom) {
                    if let rest, !restOver {
                        ProgressView(timerInterval: rest.range, countsDown: true) { EmptyView() } currentValueLabel: { EmptyView() }
                            .tint(brand)
                    }
                }
            } compactLeading: {
                Image(systemName: rest == nil || restOver ? "dumbbell.fill" : "timer")
                    .foregroundStyle(brand)
            } compactTrailing: {
                Group {
                    if let rest, !restOver {
                        Text(timerInterval: rest.range, countsDown: true)
                    } else {
                        SessionClock(startedAt: context.attributes.startedAt)
                    }
                }
                .monospacedDigit()
                .multilineTextAlignment(.trailing)
                .frame(maxWidth: 52)
            } minimal: {
                Image(systemName: rest == nil || restOver ? "dumbbell.fill" : "timer")
                    .foregroundStyle(brand)
            }
        }
    }
}

private struct LockScreenView: View {
    let context: ActivityViewContext<GymSessionAttributes>

    var body: some View {
        let rest = Rest(context.state)
        let restOver = rest != nil && context.isStale
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .firstTextBaseline) {
                Label("Session", systemImage: "dumbbell.fill")
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(.white.opacity(0.8))
                Spacer()
                SessionClock(startedAt: context.attributes.startedAt)
                    .font(.title2.weight(.bold))
                    .monospacedDigit()
                    .multilineTextAlignment(.trailing)
                    .foregroundStyle(.white)
            }
            if let rest {
                if restOver {
                    HStack {
                        Text("Rest over").font(.headline)
                        Spacer()
                        Text("Next set").font(.subheadline)
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(brand, in: RoundedRectangle(cornerRadius: 12))
                } else {
                    VStack(spacing: 6) {
                        HStack(alignment: .firstTextBaseline) {
                            Text("Rest").font(.headline)
                            Spacer()
                            Text(timerInterval: rest.range, countsDown: true)
                                .font(.title.weight(.bold))
                                .monospacedDigit()
                                .multilineTextAlignment(.trailing)
                        }
                        ProgressView(timerInterval: rest.range, countsDown: true) { EmptyView() } currentValueLabel: { EmptyView() }
                            .tint(.white)
                    }
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(brand, in: RoundedRectangle(cornerRadius: 12))
                }
            }
        }
        .padding(16)
    }
}
