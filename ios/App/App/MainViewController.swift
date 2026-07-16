import UIKit
import WebKit
import Capacitor

// Native WKWebView text inputs get WebKit's default "Previous / Next / Done"
// form-navigation accessory bar above the keyboard, which doesn't exist in
// native apps (WhatsApp etc.) and leaves a visible gap between the chat
// input bar and the keyboard. This swizzles it away.
extension WKWebView {
    private static let swizzleInputAccessoryView: Void = {
        guard
            let webViewContentClass = NSClassFromString("WKContentView"),
            let originalMethod = class_getInstanceMethod(webViewContentClass, NSSelectorFromString("inputAccessoryView")),
            let swizzledMethod = class_getInstanceMethod(WKWebView.self, #selector(getter: WKWebView.noInputAccessoryView))
        else { return }
        method_exchangeImplementations(originalMethod, swizzledMethod)
    }()

    @objc var noInputAccessoryView: AnyObject? {
        return nil
    }

    func removeInputAccessoryView() {
        _ = WKWebView.swizzleInputAccessoryView
    }
}

class MainViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        webView?.removeInputAccessoryView()
    }
}
