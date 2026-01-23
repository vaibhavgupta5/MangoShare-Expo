import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  StyleSheet,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Easing,
  PanResponder,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { io, Socket } from "socket.io-client";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import * as MediaLibrary from "expo-media-library";
import * as Linking from "expo-linking";
import {
  FileIcon,
  Image as ImageIcon,
  Video as VideoIcon,
  Archive as ArchiveIcon,
  Share2,
  Users,
  Sun,
  Moon,
  QrCode,
  Copy,
  X,
  ChevronLeft,
  Download,
  Terminal,
  ShieldCheck,
  Zap,
  Scan,
} from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import QRCode from "react-native-qrcode-svg";
import Toast, {
  BaseToast,
  ErrorToast,
  InfoToast,
} from "react-native-toast-message";
import { Buffer } from "buffer";
import {
  NavigationContainer,
  useNavigation,
  DefaultTheme,
  DarkTheme,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { BlurView } from "expo-blur";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as Notifications from "expo-notifications";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const AnimatedBlurView = Animated.createAnimatedComponent(BlurView);

// Shim Buffer
(global as any).Buffer = Buffer;

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL;

const socket: Socket = io(SOCKET_URL);

const { width } = Dimensions.get("window");

// --- Components ---

interface ThemeColors {
  primary: string;
  background: string;
  card: string;
  text: string;
  muted: string;
  border: string;
  neon: string;
}

const ThemeToggle = ({
  theme,
  setTheme,
  colors,
}: {
  theme: string;
  setTheme: (t: "dark" | "light") => void;
  colors: ThemeColors;
}) => (
  <View style={styles.themeToggle}>
    <Sun size={16} color={colors.muted} />
    <TouchableOpacity
      style={[styles.switch, { backgroundColor: colors.border }]}
      onPress={() => setTheme(theme === "dark" ? "light" : "dark")}
    >
      <View
        style={[
          styles.switchThumb,
          {
            backgroundColor: colors.neon,
            alignSelf: theme === "dark" ? "flex-end" : "flex-start",
          },
        ]}
      />
    </TouchableOpacity>
    <Moon size={16} color={colors.muted} />
  </View>
);

// --- Draggable Tray Component ---

function DraggableTray({
  children,
  onClose,
  colors,
  forceFull = false,
}: {
  children: React.ReactNode;
  onClose: () => void;
  colors: ThemeColors;
  forceFull?: boolean;
}) {
  const { height } = Dimensions.get("window");
  const initialHeight = forceFull ? height : height * 0.9;
  const [contentHeight, setContentHeight] = useState(initialHeight);
  const pan = useRef(new Animated.ValueXY({ x: 0, y: height })).current;
  const bgOpacity = useRef(new Animated.Value(0)).current;
  const hasAnimatedIn = useRef(false);

  useEffect(() => {
    // We animate to target height
    const targetHeight = forceFull
      ? height
      : Math.max(contentHeight, initialHeight);
    if (!hasAnimatedIn.current) {
      Animated.parallel([
        Animated.spring(pan.y, {
          toValue: height - targetHeight,
          useNativeDriver: false,
          friction: 8,
          tension: 40,
        }),
        Animated.timing(bgOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: false,
        }),
      ]).start(() => {
        hasAnimatedIn.current = true;
      });
    } else {
      // If content grows after initial animation
      Animated.spring(pan.y, {
        toValue: height - targetHeight,
        useNativeDriver: false,
      }).start();
    }
  }, [contentHeight]);

  const handleDismiss = () => {
    Animated.parallel([
      Animated.timing(pan.y, {
        toValue: height,
        duration: 250,
        useNativeDriver: false,
      }),
      Animated.timing(bgOpacity, {
        toValue: 0,
        duration: 250,
        useNativeDriver: false,
      }),
    ]).start(() => onClose());
  };

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 5,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy > 0) {
          const targetHeight = forceFull
            ? height
            : Math.max(contentHeight, initialHeight);
          pan.y.setValue(height - targetHeight + gesture.dy);
        }
      },
      onPanResponderRelease: (_, gesture) => {
        const targetHeight = forceFull
          ? height
          : Math.max(contentHeight, initialHeight);
        if (gesture.dy > 120 || gesture.vy > 0.5) {
          handleDismiss();
        } else {
          Animated.spring(pan.y, {
            toValue: height - targetHeight,
            useNativeDriver: false,
          }).start();
        }
      },
    }),
  ).current;

  return (
    <View style={StyleSheet.absoluteFill}>
      <AnimatedBlurView
        intensity={bgOpacity.interpolate({
          inputRange: [0, 1],
          outputRange: [0, 20],
        })}
        style={StyleSheet.absoluteFill}
        tint="dark"
      >
        <TouchableOpacity
          style={{ flex: 1 }}
          activeOpacity={1}
          onPress={handleDismiss}
        />
      </AnimatedBlurView>
      <Animated.View
        onLayout={(e) => {
          const { height: layoutHeight } = e.nativeEvent.layout;
          if (layoutHeight > initialHeight) {
            setContentHeight(layoutHeight);
          }
        }}
        style={[
          styles.trayContainer,
          {
            transform: [{ translateY: pan.y }],
            minHeight: forceFull ? height : initialHeight,
            backgroundColor: colors.background,
            borderColor: colors.border,
          },
        ]}
      >
        <View {...panResponder.panHandlers} style={styles.trayHandleOuter}>
          <View style={styles.trayHandle} />
        </View>
        <View style={{ flex: 1 }}>{children}</View>
      </Animated.View>
    </View>
  );
}

// --- Splash Screen Component ---

const ScrambledText = ({
  text,
  scramble,
  style,
}: {
  text: string;
  scramble: boolean;
  style: any;
}) => {
  const [displayText, setDisplayText] = useState(text);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+";

  useEffect(() => {
    let interval: any;
    if (scramble) {
      interval = setInterval(() => {
        setDisplayText(
          text
            .split("")
            .map((char) =>
              char === " "
                ? " "
                : chars[Math.floor(Math.random() * chars.length)],
            )
            .join(""),
        );
      }, 50);
    } else {
      setDisplayText(text);
    }
    return () => clearInterval(interval);
  }, [scramble, text]);

  return (
    <Text style={style}>
      {displayText === "MANGOSHARE" ? (
        <>
          {displayText.slice(0, 5)}
          <Text style={{ color: "#FACC15" }}>{displayText.slice(5)}</Text>
        </>
      ) : (
        displayText
      )}
    </Text>
  );
};

function SplashScreenComponent({ onFinish }: { onFinish: () => void }) {
  const fadeAnim = useState(new Animated.Value(0))[0];
  const scaleAnim = useState(new Animated.Value(0.8))[0];
  const burstAnim = useState(new Animated.Value(0))[0];
  const textOpacity = useState(new Animated.Value(0))[0];
  const [isScrambling, setIsScrambling] = useState(false);

  useEffect(() => {
    Animated.sequence([
      // Initial Fade in and Scale
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 1000,
          delay: 500,
          useNativeDriver: true,
        }),
      ]),
      // Blast effect + Scramble start
      // Blast effect + Scramble start
      Animated.timing(burstAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.exp),
        useNativeDriver: true,
      }),
      // Exit fade
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 400,
        delay: 200,
        useNativeDriver: true,
      }),
    ]).start(() => onFinish());

    // Trigger scramble manually to avoid complex Animated logic for state
    const timer = setTimeout(() => setIsScrambling(true), 2100);
    return () => clearTimeout(timer);
  }, []);

  const blastScale = burstAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 4],
  });

  const blastOpacity = burstAnim.interpolate({
    inputRange: [0, 0.8, 1],
    outputRange: [0, 0.5, 0],
  });

  return (
    <View style={splashStyles.container}>
      <StatusBar style="light" />
      <Animated.View
        style={[
          splashStyles.content,
          { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
        ]}
      >
        <Animated.View
          style={[
            splashStyles.blast,
            {
              transform: [{ scale: blastScale }],
              opacity: blastOpacity,
            },
          ]}
        />
        <View style={splashStyles.logoContainer}>
          <ScrambledText
            text="MANGOSHARE"
            scramble={isScrambling}
            style={splashStyles.title}
          />
          <Animated.View style={{ opacity: textOpacity }}>
            <ScrambledText
              text="> SECURE_P2P_SHARING_APP _"
              scramble={isScrambling}
              style={splashStyles.subtitle}
            />
          </Animated.View>
        </View>
      </Animated.View>
    </View>
  );
}

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0A0A0A",
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
  },
  logoContainer: {
    alignItems: "center",
  },
  title: {
    fontSize: 42,
    fontWeight: "bold",
    color: "#FFFFFF",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    letterSpacing: 4,
  },
  subtitle: {
    fontSize: 14,
    color: "#737373",
    marginTop: 10,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  blast: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "#FACC15",
  },
});

// --- Navigation ---
const Stack = createNativeStackNavigator();

export default function App() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const fileUri = response.notification.request.content.data?.fileUri;
        if (fileUri) {
          Sharing.shareAsync(fileUri);
        }
      },
    );
    return () => subscription.remove();
  }, []);

  const colors = {
    primary: theme === "dark" ? "#FACC15" : "#EAB308",
    background: theme === "dark" ? "#0A0A0A" : "#FAFAFA",
    card: theme === "dark" ? "#171717" : "#FFFFFF",
    text: theme === "dark" ? "#FFFFFF" : "#0A0A0A",
    muted: theme === "dark" ? "#737373" : "#737373",
    border: theme === "dark" ? "#262626" : "#E5E5E5",
    neon: theme === "dark" ? "#FACC15" : "#EAB308",
  };

  const toastConfig = {
    success: (props: any) => (
      <BaseToast
        {...props}
        style={{
          borderLeftColor: colors.neon,
          backgroundColor: colors.card,
          height: 70,
        }}
        contentContainerStyle={{ paddingHorizontal: 15 }}
        text1Style={{
          fontSize: 14,
          fontWeight: "bold",
          color: colors.neon,
          fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
        }}
        text2Style={{
          fontSize: 11,
          color: colors.muted,
          fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
        }}
      />
    ),
    error: (props: any) => (
      <ErrorToast
        {...props}
        style={{
          borderLeftColor: "#EF4444",
          backgroundColor: colors.card,
          height: 70,
        }}
        text1Style={{
          fontSize: 14,
          fontWeight: "bold",
          color: "#EF4444",
          fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
        }}
        text2Style={{
          fontSize: 11,
          color: colors.muted,
          fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
        }}
      />
    ),
    info: (props: any) => (
      <InfoToast
        {...props}
        style={{
          borderLeftColor: colors.primary,
          backgroundColor: colors.card,
          height: 70,
        }}
        text1Style={{
          fontSize: 14,
          fontWeight: "bold",
          color: colors.primary,
          fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
        }}
        text2Style={{
          fontSize: 11,
          color: colors.muted,
          fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
        }}
      />
    ),
  };

  const navTheme = {
    ...(theme === "dark" ? DarkTheme : DefaultTheme),
    colors: {
      ...(theme === "dark" ? DarkTheme.colors : DefaultTheme.colors),
      primary: colors.primary,
      background: colors.background,
      card: colors.card,
      text: colors.text,
      border: colors.border,
      notification: colors.neon,
    },
  };

  if (showSplash) {
    return <SplashScreenComponent onFinish={() => setShowSplash(false)} />;
  }

  return (
    <NavigationContainer theme={navTheme}>
      <Stack.Navigator
        screenOptions={
          {
            headerShown: false,
            animation: "slide_from_right",
            contentStyle: { backgroundColor: colors.background },
            containerStyle: { backgroundColor: colors.background },
          } as any
        }
      >
        <Stack.Screen name="Home">
          {(props) => (
            <HomeScreen
              {...props}
              colors={colors}
              theme={theme}
              setTheme={setTheme}
            />
          )}
        </Stack.Screen>
        <Stack.Screen
          name="Sender"
          options={{
            presentation: "transparentModal",
            animation: "fade",
          }}
        >
          {(props) => (
            <SenderScreen
              {...props}
              colors={colors}
              theme={theme}
              setTheme={setTheme}
            />
          )}
        </Stack.Screen>
        <Stack.Screen
          name="Receiver"
          options={{
            presentation: "transparentModal",
            animation: "fade",
          }}
        >
          {(props) => (
            <ReceiverScreen
              {...props}
              colors={colors}
              theme={theme}
              setTheme={setTheme}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
      <Toast config={toastConfig} />
    </NavigationContainer>
  );
}

// --- Screens ---

function HomeScreen({
  navigation,
  colors,
  theme,
  setTheme,
}: {
  navigation: any;
  colors: ThemeColors;
  theme: string;
  setTheme: (t: "dark" | "light") => void;
}) {
  // Handle shared files from other apps
  useEffect(() => {
    const handleUrl = (url: string) => {
      if (url && url.includes("file://")) {
        navigation.navigate("Sender", { initialFileUri: url });
      }
    };

    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    const subscription = Linking.addEventListener("url", (event) => {
      handleUrl(event.url);
    });

    return () => subscription.remove();
  }, [navigation]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.background }]}
    >
      <StatusBar style={theme === "dark" ? "light" : "dark"} />
      <LinearGradient
        colors={
          theme === "dark"
            ? ["rgba(250, 204, 21, 0.05)", "transparent"]
            : ["rgba(234, 179, 8, 0.05)", "transparent"]
        }
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.scrollContent, { marginTop: 20 }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>
            MANGO<Text style={{ color: colors.neon }}>SHARE</Text>
          </Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            {">"} SECURE P2P FILE TRANSFER _
          </Text>
          <ThemeToggle theme={theme} setTheme={setTheme} colors={colors} />
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.statusContainer}>
            <Text style={[styles.statusLabel, { color: colors.muted }]}>
              [STATUS] READY_TO_SHARE
            </Text>
          </View>
          <View style={styles.modeSelection}>
            <Text style={[styles.sectionLabel, { color: colors.muted }]}>
              SELECT_MODE:
            </Text>
            <View style={styles.modeButtons}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.neon }]}
                onPress={() => navigation.navigate("Sender")}
              >
                <Share2 size={20} color="#000" />
                <Text style={styles.buttonText}>SENDER</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.outlineButton, { borderColor: colors.neon }]}
                onPress={() => navigation.navigate("Receiver")}
              >
                <Users size={20} color={colors.neon} />
                <Text
                  style={[styles.outlineButtonText, { color: colors.neon }]}
                >
                  RECEIVER
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View
          style={[
            styles.infoCard,
            {
              backgroundColor: colors.card + "99",
              borderColor: colors.neon + "40",
            },
          ]}
        >
          <Text style={[styles.infoTitle, { color: colors.neon }]}>
            {">"} HOW_TO_USE
          </Text>
          <View style={styles.infoDivider} />
          <View style={styles.infoItem}>
            <View
              style={[styles.infoIcon, { backgroundColor: colors.neon + "20" }]}
            >
              <Zap size={14} color={colors.neon} />
            </View>
            <View>
              <Text style={[styles.infoLabel, { color: colors.neon }]}>
                [SENDER]
              </Text>
              <Text style={[styles.infoText, { color: colors.muted }]}>
                Pick file → Share Code → Transmit
              </Text>
            </View>
          </View>
          <View style={styles.infoItem}>
            <View style={[styles.infoIcon, { backgroundColor: "#FACC1520" }]}>
              <Terminal size={14} color="#FACC15" />
            </View>
            <View>
              <Text style={[styles.infoLabel, { color: "#FACC15" }]}>
                [RECEIVER]
              </Text>
              <Text style={[styles.infoText, { color: colors.muted }]}>
                Enter Code → Wait → Download
              </Text>
            </View>
          </View>
          <View style={styles.securityNote}>
            <ShieldCheck size={14} color={colors.neon} />
            <Text style={[styles.securityText, { color: colors.muted }]}>
              FILES TRANSFER DIRECTLY BETWEEN DEVICES
            </Text>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

function SenderScreen({
  navigation,
  route,
  colors,
  theme,
  setTheme,
}: {
  navigation: any;
  route: any;
  colors: ThemeColors;
  theme: string;
  setTheme: (t: "dark" | "light") => void;
}) {
  const [roomId, setRoomId] = useState("");
  const [sharer, setSharer] = useState("");
  const [filename, setFilename] = useState("");
  const [progress, setProgress] = useState(0);
  const [selectedFile, setSelectedFile] =
    useState<DocumentPicker.DocumentPickerSuccessResult | null>(null);
  const [fileSent, setFileSent] = useState(false);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [receiverConnected, setReceiverConnected] = useState(false);
  const [showQrDialog, setShowQrDialog] = useState(false);

  useEffect(() => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setRoomId(code);
    socket.emit("join-room", code);

    socket.on("receiver-joined", () => {
      setReceiverConnected(true);
      Toast.show({
        type: "success",
        text1: "Connected",
        text2: "Receiver joined the room!",
      });
    });

    socket.on("receiver-left", () => {
      setReceiverConnected(false);
      Toast.show({
        type: "error",
        text1: "Disconnected",
        text2: "Receiver left the room",
      });
    });

    return () => {
      socket.off("receiver-joined");
      socket.off("receiver-left");
    };
  }, []);

  // Handle initial file from share intent
  useEffect(() => {
    if (route.params?.initialFileUri) {
      const uri = route.params.initialFileUri;
      const name = uri.split("/").pop() || "shared_file";
      setFilename(name);
      setSelectedFile({
        canceled: false,
        assets: [{ uri, name, size: 0, mimeType: "application/octet-stream" }],
      } as any);
    }
  }, [route.params?.initialFileUri]);

  const pickFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: "*/*",
      copyToCacheDirectory: true,
    });
    if (!res.canceled) {
      setSelectedFile(res as DocumentPicker.DocumentPickerSuccessResult);
      setFilename(res.assets[0].name);
      if (res.assets[0].mimeType?.startsWith("image/"))
        setImagePreview(res.assets[0].uri);
      else setImagePreview(null);
    }
  };

  const sendFile = async () => {
    if (!selectedFile || !roomId || !sharer) {
      Alert.alert("Error", "Please enter your name and select a file.");
      return;
    }
    const file = selectedFile.assets[0];
    setIsTransmitting(true);
    setFileSent(false);

    socket.emit("file-meta", roomId, {
      filename: file.name,
      sharer,
      size: file.size,
      type: file.mimeType,
    });

    const chunkSize = 1024 * 1024;
    let offset = 0;
    const fileSize = file.size || 0;

    try {
      while (offset < fileSize) {
        const length = Math.min(chunkSize, fileSize - offset);
        const chunkBase64 = await FileSystem.readAsStringAsync(file.uri, {
          encoding: "base64",
          position: offset,
          length: length,
        });
        const chunk = Buffer.from(chunkBase64, "base64").buffer;
        offset += length;
        const percent = Math.round((offset / fileSize) * 100);
        setProgress(percent);
        socket.emit("file-chunk", roomId, chunk, percent);
      }
      setFileSent(true);
      setIsTransmitting(false);
      Toast.show({
        type: "success",
        text1: "Transmit Complete",
        text2: "File transmitted successfully!",
      });
    } catch (error) {
      setIsTransmitting(false);
      Alert.alert("Error", "Failed to transmit file.");
    }
  };

  return (
    <DraggableTray
      onClose={() => navigation.goBack()}
      colors={colors}
      forceFull={!!selectedFile}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { padding: 20 }]}
        >
          <View style={[styles.header, { marginTop: 10 }]}>
            <TouchableOpacity
              onPress={() => navigation.goBack()}
              style={styles.backButtonAbsolute}
            >
              <ChevronLeft size={24} color={colors.neon} />
            </TouchableOpacity>
            <Text style={[styles.title, { color: colors.text }]}>
              MANGO<Text style={{ color: colors.neon }}>SHARE</Text>
            </Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              {">"} SENDER_TRANSMISSION_PROTOCOL _
            </Text>
            <ThemeToggle theme={theme} setTheme={setTheme} colors={colors} />
          </View>

          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.statusContainer}>
              <View style={styles.roomBadge}>
                <Text style={[styles.statusLabel, { color: colors.muted }]}>
                  [ROOM]
                </Text>
                <Text style={[styles.roomId, { color: colors.neon }]}>
                  {roomId}
                </Text>
                <View
                  style={[styles.pulseDot, { backgroundColor: colors.neon }]}
                />
              </View>
              {receiverConnected && (
                <Text style={styles.onlineStatus}>{">"} RECEIVER_ONLINE</Text>
              )}
            </View>

            <View style={styles.senderArea}>
              <TextInput
                style={[
                  styles.input,
                  { color: colors.text, borderColor: colors.border },
                ]}
                placeholder="ENTER_YOUR_NAME"
                placeholderTextColor={colors.muted}
                value={sharer}
                onChangeText={setSharer}
              />
              <TouchableOpacity
                style={[styles.uploadArea, { borderColor: colors.border }]}
                onPress={pickFile}
              >
                <FileIcon size={24} color={colors.neon} />
                <Text style={[styles.uploadText, { color: colors.text }]}>
                  {filename ? filename : "SELECT_FILE"}
                </Text>
              </TouchableOpacity>
              {imagePreview && (
                <View style={styles.previewContainer}>
                  <Image
                    source={{ uri: imagePreview }}
                    style={styles.preview as any}
                    resizeMode="cover"
                  />
                </View>
              )}
              <TouchableOpacity
                style={[
                  styles.button,
                  {
                    backgroundColor: colors.neon,
                    opacity: !filename || !sharer || isTransmitting ? 0.5 : 1,
                  },
                ]}
                onPress={sendFile}
                disabled={!filename || !sharer || isTransmitting}
              >
                {isTransmitting ? (
                  <ActivityIndicator color="#000" />
                ) : (
                  <Text style={styles.buttonText}>TRANSMIT_FILE</Text>
                )}
              </TouchableOpacity>
              {fileSent && (
                <Text style={styles.completeText}>
                  {">"} FILE_TRANSMITTED_SUCCESSFULLY
                </Text>
              )}
              {progress > 0 && (
                <View style={styles.progressContainer}>
                  <View style={styles.progressHeader}>
                    <Text
                      style={[styles.progressLabel, { color: colors.muted }]}
                    >
                      PROGRESS:
                    </Text>
                    <Text
                      style={[styles.progressPercent, { color: colors.neon }]}
                    >
                      {progress}%
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.progressBar,
                      { backgroundColor: colors.border },
                    ]}
                  >
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${progress}%`, backgroundColor: colors.neon },
                      ]}
                    />
                  </View>
                </View>
              )}
              {roomId && (
                <View
                  style={[styles.shareBox, { borderColor: colors.neon + "40" }]}
                >
                  <Text style={[styles.shareLabel, { color: colors.muted }]}>
                    SHARE_CODE:
                  </Text>
                  <View style={styles.codeRow}>
                    <Text style={[styles.codeText, { color: colors.text }]}>
                      {roomId}
                    </Text>
                    <View style={styles.codeActions}>
                      <TouchableOpacity
                        onPress={() => Clipboard.setStringAsync(roomId)}
                        style={styles.iconButton}
                      >
                        <Copy size={18} color={colors.neon} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => setShowQrDialog(true)}
                        style={styles.iconButton}
                      >
                        <QrCode size={18} color={colors.neon} />
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {showQrDialog && (
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalContent,
              { backgroundColor: colors.card, borderColor: colors.neon },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.neon }]}>
                QR_CODE
              </Text>
              <TouchableOpacity onPress={() => setShowQrDialog(false)}>
                <X size={20} color={colors.muted} />
              </TouchableOpacity>
            </View>
            <View style={styles.qrContainer}>
              <QRCode
                value={`https://mangoshare.vercel.app/?code=${roomId}&mode=receiver`}
                size={200}
                color={colors.neon}
                backgroundColor="transparent"
              />
            </View>
            <TouchableOpacity
              style={[
                styles.outlineButton,
                { borderColor: colors.neon, marginTop: 20 },
              ]}
              onPress={() => setShowQrDialog(false)}
            >
              <Text style={[styles.outlineButtonText, { color: colors.neon }]}>
                CLOSE
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </DraggableTray>
  );
}

function ReceiverScreen({
  navigation,
  colors,
  theme,
  setTheme,
}: {
  navigation: any;
  colors: ThemeColors;
  theme: string;
  setTheme: (t: "dark" | "light") => void;
}) {
  const [roomId, setRoomId] = useState("");
  const [roomJoined, setRoomJoined] = useState(false);
  const [incomingFile, setIncomingFile] = useState<any>(null);
  const [progress, setProgress] = useState(0);
  const [receivedChunks, setReceivedChunks] = useState<ArrayBuffer[]>([]);
  const [fileReceived, setFileReceived] = useState(false);
  const [receivedFileUri, setReceivedFileUri] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    if (fileReceived && incomingFile && receivedChunks.length > 0) {
      if (incomingFile.type?.startsWith("image/")) {
        const totalLength = receivedChunks.reduce(
          (acc, curr) => acc + curr.byteLength,
          0,
        );
        const combined = new Uint8Array(totalLength);
        let currentOffset = 0;
        for (const chunk of receivedChunks) {
          combined.set(new Uint8Array(chunk), currentOffset);
          currentOffset += chunk.byteLength;
        }
        const base64 = Buffer.from(combined).toString("base64");
        setReceivedFileUri(`data:${incomingFile.type};base64,${base64}`);
      }
    }
  }, [fileReceived, incomingFile, receivedChunks]);

  useEffect(() => {
    socket.on("file-meta", (meta) => {
      setIncomingFile(meta);
      setProgress(0);
      setFileReceived(false);
      setReceivedChunks([]);
      Toast.show({
        type: "info",
        text1: "Incoming File",
        text2: `Receiving ${meta.filename} from ${meta.sharer}`,
      });
    });

    socket.on("file-chunk", (chunk: any, percent: number) => {
      setProgress(percent);
      const buffer =
        chunk instanceof ArrayBuffer
          ? chunk
          : Buffer.isBuffer(chunk)
            ? chunk.buffer
            : new Uint8Array(chunk).buffer;
      setReceivedChunks((prev) => [...prev, buffer as ArrayBuffer]);
      if (percent === 100) {
        setFileReceived(true);
        Toast.show({
          type: "success",
          text1: "Success",
          text2: "File received successfully!",
        });
      }
    });

    return () => {
      socket.off("file-meta");
      socket.off("file-chunk");
    };
  }, []);

  const joinRoom = () => {
    if (roomId.length === 6) {
      socket.emit("join-room", roomId);
      setRoomJoined(true);
      Toast.show({
        type: "success",
        text1: "Connected",
        text2: `Joined room ${roomId}`,
      });
    }
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    setIsScanning(false);
    // Extract code from URL if possible
    let code = data;
    if (data.includes("code=")) {
      const match = data.match(/code=([^&]+)/);
      if (match) code = match[1];
    }
    setRoomId(code);
    socket.emit("join-room", code);
    setRoomJoined(true);
    Toast.show({
      type: "success",
      text1: "QR Scanned",
      text2: `Joined room ${code}`,
    });
  };

  const startScanning = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        Alert.alert(
          "Permission Denied",
          "Camera permission is required to scan QR codes.",
        );
        return;
      }
    }
    setIsScanning(true);
  };

  const downloadFile = async () => {
    if (!fileReceived || !incomingFile || receivedChunks.length === 0) return;
    try {
      const sanitizedFilename = incomingFile.filename.replace(/\s+/g, "_");
      const fileUri = `${FileSystem.cacheDirectory}${sanitizedFilename}`;
      const totalLength = receivedChunks.reduce(
        (acc, curr) => acc + curr.byteLength,
        0,
      );
      const combined = new Uint8Array(totalLength);
      let currentOffset = 0;
      for (const chunk of receivedChunks) {
        combined.set(new Uint8Array(chunk), currentOffset);
        currentOffset += chunk.byteLength;
      }
      const base64 = Buffer.from(combined).toString("base64");
      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: "base64",
      });

      // Request Media Library Permission & Save
      try {
        const { status } = await MediaLibrary.requestPermissionsAsync(true);
        if (
          status === "granted" &&
          (incomingFile.type?.startsWith("image") ||
            incomingFile.type?.startsWith("video"))
        ) {
          await MediaLibrary.saveToLibraryAsync(fileUri);
          Toast.show({
            type: "success",
            text1: "Saved",
            text2: "Saved to your gallery!",
          });
          return;
        }
      } catch (saveError) {
        console.error("Gallery save failed:", saveError);
      }

      // Fallback to sharing menu for non-media or if gallery save failed/denied
      await Sharing.shareAsync(fileUri);

      // Simple notification
      await Notifications.scheduleNotificationAsync({
        content: {
          title: "File Saved",
          body: `Protocol complete: ${incomingFile.filename} has been stored. Tap to open or share.`,
          data: { fileUri },
        },
        trigger: null,
      });
    } catch (error) {
      console.error("Download Error:", error);
      Alert.alert("Error", "Failed to save file.");
    }
  };

  return (
    <DraggableTray
      onClose={() => navigation.goBack()}
      colors={colors}
      forceFull={fileReceived || isScanning}
    >
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { padding: 20 }]}
      >
        <View style={[styles.header, { marginTop: 10 }]}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButtonAbsolute}
          >
            <ChevronLeft size={24} color={colors.neon} />
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>
            MANGO<Text style={{ color: colors.neon }}>SHARE</Text>
          </Text>
          <Text style={[styles.subtitle, { color: colors.muted }]}>
            {">"} RECEIVER_RECEPTION_PROTOCOL _
          </Text>
          <ThemeToggle theme={theme} setTheme={setTheme} colors={colors} />
        </View>

        <View
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          {roomJoined && (
            <View
              style={[
                styles.statusContainer,
                {
                  borderBottomWidth: 1,
                  borderBottomColor: colors.border,
                  paddingBottom: 15,
                  marginBottom: 15,
                },
              ]}
            >
              <View style={styles.roomBadge}>
                <Text style={[styles.statusLabel, { color: colors.muted }]}>
                  [ROOM]
                </Text>
                <Text style={[styles.roomId, { color: colors.neon }]}>
                  {roomId}
                </Text>
                <View
                  style={[styles.pulseDot, { backgroundColor: colors.neon }]}
                />
              </View>
              <Text style={styles.onlineStatus}>
                {">"} CONNECTED_READY_TO_RECEIVE
              </Text>
            </View>
          )}
          {!roomJoined ? (
            isScanning ? (
              <View style={styles.scannerWrapper}>
                <View style={styles.scannerHeader}>
                  <Text style={[styles.statusLabel, { color: colors.neon }]}>
                    [SCANNING_QR_CODE]
                  </Text>
                  <TouchableOpacity onPress={() => setIsScanning(false)}>
                    <X size={24} color={colors.muted} />
                  </TouchableOpacity>
                </View>
                <View style={styles.cameraContainer}>
                  <CameraView
                    style={styles.camera}
                    onBarcodeScanned={handleBarCodeScanned}
                    barcodeScannerSettings={{
                      barcodeTypes: ["qr"],
                    }}
                  />
                  <View style={styles.overlay}>
                    <View style={styles.unfocusedContainer}></View>
                    <View style={styles.focusedContainer}>
                      <View style={styles.unfocusedContainer}></View>
                      <View
                        style={[styles.focused, { borderColor: colors.neon }]}
                      ></View>
                      <View style={styles.unfocusedContainer}></View>
                    </View>
                    <View style={styles.unfocusedContainer}></View>
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.joinForm}>
                <Text
                  style={[
                    styles.sectionLabel,
                    { color: colors.muted, marginBottom: 10 },
                  ]}
                >
                  ENTER_ROOM_CODE:
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    { color: colors.text, borderColor: colors.border },
                  ]}
                  placeholder="000000"
                  placeholderTextColor={colors.muted}
                  value={roomId}
                  onChangeText={(val) =>
                    setRoomId(val.replace(/\D/g, "").slice(0, 6))
                  }
                  keyboardType="numeric"
                  maxLength={6}
                />
                <TouchableOpacity
                  style={[
                    styles.button,
                    {
                      backgroundColor: colors.neon,
                      opacity: roomId.length !== 6 ? 0.5 : 1,
                      marginTop: 10,
                    },
                  ]}
                  onPress={joinRoom}
                  disabled={roomId.length !== 6}
                >
                  <Text style={styles.buttonText}>CONNECT_TO_ROOM</Text>
                </TouchableOpacity>
                <View style={styles.orDivider}>
                  <View
                    style={[
                      styles.dividerLine,
                      { backgroundColor: colors.border },
                    ]}
                  />
                  <Text style={[styles.orText, { color: colors.muted }]}>
                    OR
                  </Text>
                  <View
                    style={[
                      styles.dividerLine,
                      { backgroundColor: colors.border },
                    ]}
                  />
                </View>
                <TouchableOpacity
                  style={[
                    styles.outlineButton,
                    { borderColor: colors.neon, marginTop: 10 },
                  ]}
                  onPress={startScanning}
                >
                  <Scan size={20} color={colors.neon} />
                  <Text
                    style={[styles.outlineButtonText, { color: colors.neon }]}
                  >
                    SCAN_QR_CODE
                  </Text>
                </TouchableOpacity>
              </View>
            )
          ) : incomingFile ? (
            <View style={styles.receivedFile}>
              <View
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                    width: "100%",
                  },
                ]}
              >
                <View style={[styles.statusContainer, { marginBottom: 15 }]}>
                  <Text style={[styles.statusLabel, { color: colors.muted }]}>
                    [INCOMING_TRANSFER]
                  </Text>
                  <Text
                    style={[
                      styles.filename,
                      { color: colors.text, textAlign: "center", fontSize: 18 },
                    ]}
                  >
                    {incomingFile.filename}
                  </Text>
                  <Text style={[styles.fileMeta, { color: colors.muted }]}>
                    {(incomingFile.size / 1024 / 1024).toFixed(2)} MB •{" "}
                    {incomingFile.type}
                  </Text>
                </View>

                {receivedFileUri && (
                  <View
                    style={[
                      styles.previewContainer,
                      { marginBottom: 20, height: 250, width: "100%" },
                    ]}
                  >
                    <Image
                      source={{ uri: receivedFileUri }}
                      style={styles.preview as any}
                      resizeMode="contain"
                    />
                  </View>
                )}

                {progress > 0 && progress < 100 && (
                  <View
                    style={[styles.progressContainer, { marginBottom: 20 }]}
                  >
                    <View style={styles.progressHeader}>
                      <Text
                        style={[styles.progressLabel, { color: colors.muted }]}
                      >
                        TRANSMISSION_PROGRESS
                      </Text>
                      <Text
                        style={[styles.progressPercent, { color: colors.neon }]}
                      >
                        {progress}%
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.progressBar,
                        { backgroundColor: colors.border },
                      ]}
                    >
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${progress}%`,
                            backgroundColor: colors.neon,
                          },
                        ]}
                      />
                    </View>
                  </View>
                )}

                {fileReceived && (
                  <TouchableOpacity
                    style={[
                      styles.button,
                      { backgroundColor: colors.neon, marginTop: 10 },
                    ]}
                    onPress={downloadFile}
                  >
                    <Download size={20} color="#000" />
                    <Text style={[styles.buttonText, { color: "#000" }]}>
                      SAVE_TO_DEVICE
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.waitingArea}>
              <Text style={[styles.waitingText, { color: colors.muted }]}>
                WAITING_FOR_FILE...
              </Text>
              <ActivityIndicator
                color={colors.neon}
                style={{ marginTop: 10 }}
              />
            </View>
          )}
        </View>
      </ScrollView>
    </DraggableTray>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 30 },
  scrollContent: { paddingVertical: 20, paddingBottom: 40 },
  header: { alignItems: "center", marginBottom: 30, marginTop: 20 },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    marginTop: 5,
  },
  themeToggle: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 15,
    gap: 8,
  },
  switch: { width: 40, height: 20, borderRadius: 10, padding: 2 },
  switchThumb: { width: 16, height: 16, borderRadius: 8 },
  card: { borderRadius: 16, borderWidth: 1, padding: 20, elevation: 8 },
  statusContainer: { alignItems: "center", marginBottom: 20 },
  roomBadge: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusLabel: {
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  roomId: {
    fontSize: 14,
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#FACC15",
  },
  onlineStatus: {
    fontSize: 10,
    color: "#4ADE80",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    marginTop: 5,
  },
  modeSelection: { gap: 15 },
  sectionLabel: {
    fontSize: 12,
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  modeButtons: { flexDirection: "row", gap: 12 },
  button: {
    flex: 1,
    height: 50,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  buttonText: {
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  outlineButton: {
    flex: 1,
    height: 50,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  outlineButtonText: {
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  senderArea: { gap: 15 },
  trayOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
  },
  trayContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    overflow: "hidden",
    elevation: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
  trayHandleOuter: {
    width: "100%",
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  trayHandle: {
    width: 40,
    height: 5,
    backgroundColor: "rgba(115, 115, 115, 0.4)",
    borderRadius: 3,
  },
  backButtonAbsolute: {
    position: "absolute",
    left: 0,
    top: 10,
    padding: 10,
    zIndex: 10,
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 15,
    gap: 5,
  },
  backText: {
    fontSize: 11,
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  uploadArea: {
    height: 80,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  uploadText: {
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    paddingHorizontal: 10,
    textAlign: "center",
  },
  previewContainer: {
    height: 150,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#262626",
  },
  preview: { width: "100%", height: "100%" },
  completeText: {
    textAlign: "center",
    color: "#4ADE80",
    fontSize: 10,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  progressContainer: { gap: 8, marginVertical: 10 },
  progressHeader: { flexDirection: "row", justifyContent: "space-between" },
  progressLabel: {
    fontSize: 10,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  progressPercent: {
    fontSize: 10,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  progressBar: { height: 4, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: "100%" },
  shareBox: {
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: "rgba(250, 204, 21, 0.05)",
  },
  shareLabel: {
    fontSize: 10,
    marginBottom: 8,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  codeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  codeText: {
    fontSize: 24,
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  codeActions: { flexDirection: "row", gap: 15 },
  iconButton: { padding: 5 },
  shareInfo: {
    fontSize: 10,
    marginTop: 8,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  receiverArea: { gap: 15 },
  joinForm: { gap: 15 },
  receivedFile: { gap: 20, padding: 10 },
  fileInfo: { flexDirection: "row", alignItems: "center", gap: 15 },
  fileText: { flex: 1 },
  filename: {
    fontSize: 14,
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  fileMeta: {
    fontSize: 10,
    marginTop: 4,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  waitingArea: {
    padding: 40,
    alignItems: "center",
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 12,
    borderColor: "#262626",
  },
  waitingText: {
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  infoCard: {
    marginTop: 20,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    gap: 15,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: "bold",
    textAlign: "center",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  infoDivider: {
    height: 1,
    backgroundColor: "rgba(250, 204, 21, 0.2)",
    width: "40%",
    alignSelf: "center",
  },
  infoItem: { flexDirection: "row", gap: 15, alignItems: "center" },
  infoIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  infoText: {
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  securityNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(250, 204, 21, 0.1)",
    padding: 10,
    borderRadius: 8,
  },
  securityText: {
    fontSize: 9,
    flex: 1,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.8)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  modalContent: {
    width: "85%",
    padding: 25,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginBottom: 20,
    alignItems: "center",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "bold",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  qrContainer: { padding: 20, backgroundColor: "white", borderRadius: 15 },
  orDivider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 15,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  orText: {
    marginHorizontal: 15,
    fontSize: 10,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  scannerWrapper: {
    flex: 1,
    gap: 15,
  },
  scannerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cameraContainer: {
    height: 300,
    borderRadius: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#262626",
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
  },
  unfocusedContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  focusedContainer: {
    flexDirection: "row",
    height: 200,
  },
  focused: {
    width: 200,
    height: 200,
    borderWidth: 2,
    borderRadius: 20,
    backgroundColor: "transparent",
  },
});
