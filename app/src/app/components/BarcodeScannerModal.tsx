import { useEffect, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";

interface Props {
  visible: boolean;
  onScanned: (code: string) => void;
  onClose: () => void;
}

export default function BarcodeScannerModal({ visible, onScanned, onClose }: Props) {
  const [permission, requestPermission] = useCameraPermissions();
  // Prevent double-fire: ignore subsequent scans until modal is closed & reopened
  const scannedRef = useRef(false);

  useEffect(() => {
    if (visible) {
      scannedRef.current = false;
    }
  }, [visible]);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scannedRef.current) return;
    scannedRef.current = true;
    onScanned(data);
  };

  if (!visible) return null;

  // Permission not yet determined
  if (!permission) {
    return (
      <Modal visible animationType="slide" onRequestClose={onClose}>
        <View style={s.center}>
          <Text style={s.message}>Requesting camera permission…</Text>
        </View>
      </Modal>
    );
  }

  // Permission denied
  if (!permission.granted) {
    return (
      <Modal visible animationType="slide" onRequestClose={onClose}>
        <View style={s.center}>
          <Text style={s.message}>Camera access is required to scan barcodes.</Text>
          <Pressable style={s.grantBtn} onPress={requestPermission}>
            <Text style={s.grantBtnText}>Grant Permission</Text>
          </Pressable>
          <Pressable style={s.cancelBtn} onPress={onClose}>
            <Text style={s.cancelBtnText}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={s.container}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          onBarcodeScanned={handleBarCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e", "code128", "code39", "qr"],
          }}
        />

        {/* Darkened overlay with scan window */}
        <View style={s.overlay} pointerEvents="none">
          <View style={s.overlayTop} />
          <View style={s.overlayMiddle}>
            <View style={s.overlaySide} />
            <View style={s.scanWindow}>
              {/* Corner markers */}
              <View style={[s.corner, s.cornerTL]} />
              <View style={[s.corner, s.cornerTR]} />
              <View style={[s.corner, s.cornerBL]} />
              <View style={[s.corner, s.cornerBR]} />
            </View>
            <View style={s.overlaySide} />
          </View>
          <View style={s.overlayBottom} />
        </View>

        {/* Labels */}
        <View style={s.labelContainer} pointerEvents="none">
          <Text style={s.title}>Scan Barcode</Text>
          <Text style={s.hint}>Point the camera at a product barcode</Text>
        </View>

        {/* Cancel */}
        <Pressable style={s.cancelBtn} onPress={onClose}>
          <Text style={s.cancelBtnText}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const SCAN_WINDOW = 260;
const OVERLAY_COLOR = "rgba(0,0,0,0.60)";
const CORNER_SIZE = 24;
const CORNER_BORDER = 3;
const CORNER_COLOR = "#16a34a";

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
    padding: 32,
  },
  message: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 24,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "column",
  },
  overlayTop: {
    flex: 1,
    backgroundColor: OVERLAY_COLOR,
  },
  overlayMiddle: {
    height: SCAN_WINDOW,
    flexDirection: "row",
  },
  overlaySide: {
    flex: 1,
    backgroundColor: OVERLAY_COLOR,
  },
  scanWindow: {
    width: SCAN_WINDOW,
    height: SCAN_WINDOW,
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: OVERLAY_COLOR,
  },
  // Corner markers
  corner: {
    position: "absolute",
    width: CORNER_SIZE,
    height: CORNER_SIZE,
    borderColor: CORNER_COLOR,
    borderWidth: 0,
  },
  cornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: CORNER_BORDER,
    borderLeftWidth: CORNER_BORDER,
  },
  cornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: CORNER_BORDER,
    borderRightWidth: CORNER_BORDER,
  },
  cornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: CORNER_BORDER,
    borderLeftWidth: CORNER_BORDER,
  },
  cornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: CORNER_BORDER,
    borderRightWidth: CORNER_BORDER,
  },
  labelContainer: {
    position: "absolute",
    top: 72,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  title: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 6,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  hint: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 13,
    textShadowColor: "rgba(0,0,0,0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  grantBtn: {
    backgroundColor: "#16a34a",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  grantBtnText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  cancelBtn: {
    position: "absolute",
    bottom: 48,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 36,
    paddingVertical: 14,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
  },
  cancelBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
