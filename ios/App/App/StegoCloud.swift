import Foundation
import Capacitor

/// Reads and writes the deck file inside the app's iCloud container so the Mac
/// build and this one share one file. Capacitor's Filesystem plugin only reaches
/// local storage, hence this small bridge.
///
/// Every entry point fails soft: without the entitlement, without a signed-in
/// iCloud account, or on a free developer account, `available` returns false and
/// the JavaScript side falls back to local storage.
@objc(StegoCloudPlugin)
public class StegoCloudPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "StegoCloudPlugin"
    public let jsName = "StegoCloud"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "available", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "read", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "write", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readIncoming", returnType: CAPPluginReturnPromise)
    ]

    /// Must match the container id used by the Electron build.
    private static let containerID = "iCloud.com.jonlee.stego"

    /// Resolving the container hits the disk, so never call this on the main thread.
    private func documentsURL() -> URL? {
        guard let container = FileManager.default.url(
            forUbiquityContainerIdentifier: StegoCloudPlugin.containerID
        ) else { return nil }

        let documents = container.appendingPathComponent("Documents", isDirectory: true)
        if !FileManager.default.fileExists(atPath: documents.path) {
            try? FileManager.default.createDirectory(
                at: documents, withIntermediateDirectories: true
            )
        }
        return documents
    }

    @objc func available(_ call: CAPPluginCall) {
        DispatchQueue.global(qos: .userInitiated).async {
            let ok = self.documentsURL() != nil
            call.resolve(["available": ok])
        }
    }

    @objc func read(_ call: CAPPluginCall) {
        guard let name = call.getString("path") else {
            call.reject("path is required")
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            guard let file = self.documentsURL()?.appendingPathComponent(name) else {
                call.resolve(["contents": NSNull()])
                return
            }

            // The file may exist in the container but not yet on this device.
            if !FileManager.default.fileExists(atPath: file.path) {
                try? FileManager.default.startDownloadingUbiquitousItem(at: file)
            }

            var contents: String?
            var coordinationError: NSError?
            NSFileCoordinator().coordinate(
                readingItemAt: file, options: .withoutChanges, error: &coordinationError
            ) { url in
                contents = try? String(contentsOf: url, encoding: .utf8)
            }

            call.resolve(["contents": contents ?? NSNull()])
        }
    }

    @objc func write(_ call: CAPPluginCall) {
        guard let name = call.getString("path"), let contents = call.getString("contents") else {
            call.reject("path and contents are required")
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            guard let file = self.documentsURL()?.appendingPathComponent(name) else {
                call.reject("iCloud is not available")
                return
            }

            var writeError: Error?
            var coordinationError: NSError?
            NSFileCoordinator().coordinate(
                writingItemAt: file, options: .forReplacing, error: &coordinationError
            ) { url in
                do {
                    try contents.write(to: url, atomically: true, encoding: .utf8)
                } catch {
                    writeError = error
                }
            }

            if let error = writeError ?? coordinationError {
                call.reject("Could not write to iCloud: \(error.localizedDescription)")
            } else {
                call.resolve()
            }
        }
    }

    /// Reads a file handed to the app from elsewhere, such as a deck arriving
    /// through Messages or AirDrop.
    ///
    /// These URLs are security scoped. Without claiming access first the read
    /// fails, which is why the Filesystem plugin cannot be used here: the deck
    /// would download, the app would open, and nothing would appear.
    @objc func readIncoming(_ call: CAPPluginCall) {
        guard let raw = call.getString("url"), let url = URL(string: raw) ?? URL(string: raw.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? "") else {
            call.reject("url is required")
            return
        }

        DispatchQueue.global(qos: .userInitiated).async {
            let scoped = url.startAccessingSecurityScopedResource()
            defer { if scoped { url.stopAccessingSecurityScopedResource() } }

            var contents: String?
            var coordinationError: NSError?
            NSFileCoordinator().coordinate(
                readingItemAt: url, options: .withoutChanges, error: &coordinationError
            ) { readURL in
                contents = try? String(contentsOf: readURL, encoding: .utf8)
            }

            // Fall back to a plain read for URLs that are not coordinated.
            if contents == nil {
                contents = try? String(contentsOf: url, encoding: .utf8)
            }

            call.resolve(["contents": contents ?? NSNull()])
        }
    }
}
