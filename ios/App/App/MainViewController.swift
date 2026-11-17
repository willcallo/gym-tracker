import Capacitor
import UIKit

// The app's one screen: Capacitor's web view, plus the app's own native plugin.
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(GymTimerPlugin())
    }
}
