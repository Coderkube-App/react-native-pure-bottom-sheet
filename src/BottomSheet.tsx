/**
 * react-native-pure-bottom-sheet
 *
 * A lightweight, zero-dependency, performant drag-to-dismiss bottom sheet
 * for React Native and Expo. Uses only the built-in Animated API and
 * PanResponder.
 */

import React, {
  useRef,
  useEffect,
  useCallback,
  useMemo,
  forwardRef,
  useImperativeHandle,
  useState,
} from 'react';
import {
  View,
  StyleSheet,
  Animated,
  PanResponder,
  useWindowDimensions,
  TouchableWithoutFeedback,
  Modal,
  ScrollView,
  StyleProp,
  ViewStyle,
  Keyboard,
  Platform,
} from 'react-native';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SnapPoint = number;

export interface BottomSheetProps {
  /** Whether the sheet is visible. */
  visible: boolean;

  /** Called when the sheet requests to be closed (drag-to-dismiss or backdrop tap). */
  onClose: () => void;

  /**
   * Ordered array of snap points expressed as **fractions of screen height**
   * (e.g. `[0.3, 0.6, 0.9]`). The sheet will snap to the nearest point
   * when released. The **first** value is the initial snap position.
   * @default [0.5]
   */
  snapPoints?: SnapPoint[];

  /**
   * Index into `snapPoints` that the sheet opens to initially.
   * @default 0
   */
  initialSnapIndex?: number;

  /**
   * If `true` the sheet closes when dragged below the lowest snap point.
   * @default true
   */
  enableDragToClose?: boolean;

  /**
   * Threshold (fraction of lowest snap height) below which the sheet auto-closes.
   * @default 0.35
   */
  closeThreshold?: number;

  /** Show a translucent backdrop behind the sheet. @default true */
  showBackdrop?: boolean;

  /** Backdrop color. @default '#000000' */
  backdropColor?: string;

  /** Backdrop max opacity (0-1). @default 0.5 */
  backdropOpacity?: number;

  /** Close the sheet when the backdrop is tapped. @default true */
  closeOnBackdropPress?: boolean;

  /** Show the drag handle indicator at the top of the sheet. @default true */
  showHandle?: boolean;

  /** Color of the drag handle. @default '#C4C4C4' */
  handleColor?: string;

  /** Style overrides for the sheet container. */
  containerStyle?: StyleProp<ViewStyle>;

  /** Style overrides for the inner content wrapper. */
  contentStyle?: StyleProp<ViewStyle>;

  /**
   * Spring animation configuration for snap transitions.
   * @default { tension: 170, friction: 26 }
   */
  springConfig?: {
    tension?: number;
    friction?: number;
  };

  /**
   * Automatically slide the bottom sheet up when the keyboard is visible
   * to prevent covering input fields.
   * @default true
   */
  avoidKeyboard?: boolean;

  /**
   * If `true`, the bottom sheet will dynamically measure its children's height
   * and snap exactly to fit the content size, overriding standard snapPoints.
   * @default false
   */
  fitContent?: boolean;

  /**
   * Called when the sheet snaps to a new snap point index.
   */
  onSnap?: (index: number) => void;

  /** Content to render inside the sheet. */
  children?: React.ReactNode;
}

export interface BottomSheetRef {
  /** Programmatically snap to a specific snap-point index. */
  snapTo: (index: number) => void;
  /** Programmatically close the sheet. */
  close: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_SNAP: SnapPoint[] = [0.5];
const VELOCITY_THRESHOLD = 0.5; // fast fling detection

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const BottomSheet = forwardRef<BottomSheetRef, BottomSheetProps>(
  (
    {
      visible,
      onClose,
      snapPoints = DEFAULT_SNAP,
      initialSnapIndex = 0,
      enableDragToClose = true,
      closeThreshold = 0.35,
      showBackdrop = true,
      backdropColor = '#000000',
      backdropOpacity = 0.5,
      closeOnBackdropPress = true,
      showHandle = true,
      handleColor = '#C4C4C4',
      containerStyle,
      contentStyle,
      springConfig,
      avoidKeyboard = true,
      fitContent = false,
      onSnap,
      children,
    },
    ref,
  ) => {
    const { height: screenHeight } = useWindowDimensions();

    // Internal rendering state to coordinate smooth exit animations
    const [shouldRender, setShouldRender] = useState(visible);

    // Track dynamic measured content height for auto-sizing (fitContent)
    const [measuredContentHeight, setMeasuredContentHeight] = useState(0);

    // -----------------------------------------------------------------------
    // Derived values
    // -----------------------------------------------------------------------

    /** Snap points converted to absolute pixel positions (from top of screen). */
    const snapPositions = useMemo(() => {
      if (fitContent && measuredContentHeight > 0) {
        // Clamp top bounds to prevent the sheet from extending above the status bar
        const openedY = Math.max(60, screenHeight - measuredContentHeight - 40);
        return [openedY];
      }
      return [...snapPoints]
        .sort((a, b) => a - b) // ascending by fraction
        .map((frac) => screenHeight * (1 - frac));
    }, [snapPoints, screenHeight, fitContent, measuredContentHeight]);

    const lowestSnapY = snapPositions[snapPositions.length - 1]; // highest Y = smallest sheet
    const highestSnapY = snapPositions[0]; // lowest Y = tallest sheet
    const initialY =
      snapPositions[Math.min(initialSnapIndex, snapPositions.length - 1)] ??
      lowestSnapY;

    // -----------------------------------------------------------------------
    // Animated values & offsets
    // -----------------------------------------------------------------------

    const translateY = useRef(new Animated.Value(screenHeight)).current;
    const keyboardOffset = useRef(new Animated.Value(0)).current;
    const backdropAnim = useRef(new Animated.Value(0)).current;
    const lastTranslateY = useRef(screenHeight);
    const [isScrollEnabled, setIsScrollEnabled] = useState(true);

    // Track whether content scroll is at top (for drag-to-dismiss interaction)
    const scrollOffsetY = useRef(0);
    const isAtTopOfScroll = useRef(true);

    // -----------------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------------

    const springTo = useCallback(
      (toValue: number, onFinish?: () => void) => {
        lastTranslateY.current = toValue;

        // Backdrop opacity is proportional to how open the sheet is
        const openFraction = 1 - toValue / screenHeight;

        Animated.parallel([
          Animated.spring(translateY, {
            toValue,
            tension: springConfig?.tension ?? 170,
            friction: springConfig?.friction ?? 26,
            useNativeDriver: true,
          }),
          Animated.timing(backdropAnim, {
            toValue: Math.max(0, openFraction * backdropOpacity),
            duration: 250,
            useNativeDriver: true,
          }),
        ]).start(({ finished }) => {
          if (finished && onFinish) onFinish();
        });
      },
      [translateY, backdropAnim, backdropOpacity, springConfig, screenHeight],
    );

    const closeSheet = useCallback(() => {
      springTo(screenHeight, () => {
        setShouldRender(false);
        onClose();
      });
    }, [springTo, onClose, screenHeight]);

    const snapToNearest = useCallback(
      (currentY: number, velocityY: number) => {
        // Fast fling down → close
        if (
          enableDragToClose &&
          velocityY > VELOCITY_THRESHOLD &&
          currentY > lowestSnapY * (1 - closeThreshold)
        ) {
          closeSheet();
          return;
        }

        // Fast fling up → snap to highest
        if (velocityY < -VELOCITY_THRESHOLD) {
          springTo(highestSnapY, () => {
            if (onSnap) onSnap(0);
          });
          return;
        }

        // Check close threshold
        const lowestSnapHeight = screenHeight - lowestSnapY;
        const currentHeight = screenHeight - currentY;
        if (
          enableDragToClose &&
          currentHeight < lowestSnapHeight * closeThreshold
        ) {
          closeSheet();
          return;
        }

        // Find nearest snap point
        let nearest = snapPositions[0];
        let minDist = Math.abs(currentY - nearest);
        let nearestIndex = 0;
        for (let i = 1; i < snapPositions.length; i++) {
          const dist = Math.abs(currentY - snapPositions[i]);
          if (dist < minDist) {
            minDist = dist;
            nearest = snapPositions[i];
            nearestIndex = i;
          }
        }

        springTo(nearest, () => {
          if (onSnap) onSnap(nearestIndex);
        });
      },
      [
        snapPositions,
        enableDragToClose,
        closeThreshold,
        lowestSnapY,
        highestSnapY,
        springTo,
        closeSheet,
        screenHeight,
        onSnap,
      ],
    );

    // -----------------------------------------------------------------------
    // Keyboard Event Handling
    // -----------------------------------------------------------------------

    useEffect(() => {
      const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
      const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

      const showSubscription = Keyboard.addListener(showEvent, (event) => {
        if (avoidKeyboard) {
          Animated.spring(keyboardOffset, {
            toValue: -event.endCoordinates.height,
            tension: springConfig?.tension ?? 170,
            friction: springConfig?.friction ?? 26,
            useNativeDriver: true,
          }).start();
        }
      });

      const hideSubscription = Keyboard.addListener(hideEvent, () => {
        if (avoidKeyboard) {
          Animated.spring(keyboardOffset, {
            toValue: 0,
            tension: springConfig?.tension ?? 170,
            friction: springConfig?.friction ?? 26,
            useNativeDriver: true,
          }).start();
        }
      });

      return () => {
        showSubscription.remove();
        hideSubscription.remove();
      };
    }, [avoidKeyboard, keyboardOffset, springConfig]);

    // -----------------------------------------------------------------------
    // Pan Responder
    // -----------------------------------------------------------------------

    const panResponder = useMemo(
      () =>
        PanResponder.create({
          onStartShouldSetPanResponder: () => false,
          onMoveShouldSetPanResponder: (_, gestureState) => {
            // Only capture vertical drags
            const { dy, dx } = gestureState;
            if (Math.abs(dy) < 10) return false;
            if (Math.abs(dx) > Math.abs(dy)) return false;

            // If dragging down and scroll is at top, capture
            if (dy > 0 && isAtTopOfScroll.current) return true;

            // If dragging up and sheet is not fully expanded, capture
            if (dy < 0 && lastTranslateY.current > highestSnapY) return true;

            return false;
          },
          onPanResponderGrant: () => {
            setIsScrollEnabled(false);
            // Captures exact visual coordinates to prevent jumps mid-spring
            translateY.stopAnimation((value) => {
              lastTranslateY.current = value;
            });
          },
          onPanResponderMove: (_, gestureState) => {
            const newY = lastTranslateY.current + gestureState.dy;
            // Clamp: don't allow dragging above highest snap
            const clamped = Math.max(highestSnapY - 40, newY); // allow slight overscroll
            translateY.setValue(clamped);

            // Update backdrop
            const openFraction = 1 - clamped / screenHeight;
            backdropAnim.setValue(
              Math.max(0, openFraction * backdropOpacity),
            );
          },
          onPanResponderRelease: (_, gestureState) => {
            setIsScrollEnabled(true);
            const currentY = lastTranslateY.current + gestureState.dy;
            snapToNearest(currentY, gestureState.vy);
          },
          onPanResponderTerminate: () => {
            setIsScrollEnabled(true);
          },
        }),
      [
        highestSnapY,
        translateY,
        backdropAnim,
        backdropOpacity,
        snapToNearest,
        screenHeight,
      ],
    );

    // -----------------------------------------------------------------------
    // Imperative handle
    // -----------------------------------------------------------------------

    useImperativeHandle(ref, () => ({
      snapTo: (index: number) => {
        const targetIndex = Math.min(index, snapPositions.length - 1);
        const target = snapPositions[targetIndex] ?? lowestSnapY;
        springTo(target, () => {
          if (onSnap) onSnap(targetIndex);
        });
      },
      close: () => {
        closeSheet();
      },
    }));

    // -----------------------------------------------------------------------
    // Effects
    // -----------------------------------------------------------------------

    useEffect(() => {
      if (visible) {
        setShouldRender(true);
        // Offscreen reset then animate up
        translateY.setValue(screenHeight);
        lastTranslateY.current = screenHeight;
        requestAnimationFrame(() => {
          springTo(initialY);
        });
      } else {
        // Trigger smooth slide down exit animation when visible changes to false
        closeSheet();
      }
    }, [visible, initialY, springTo, closeSheet, screenHeight, translateY]);

    // Handle initial fitContent bounce transition once measured height is resolved
    const prevContentHeight = useRef(0);
    useEffect(() => {
      if (fitContent && measuredContentHeight > 0 && prevContentHeight.current === 0) {
        prevContentHeight.current = measuredContentHeight;
        if (visible) {
          springTo(snapPositions[0]);
        }
      }
    }, [fitContent, measuredContentHeight, snapPositions, visible, springTo]);

    // -----------------------------------------------------------------------
    // ScrollView & Layout tracking
    // -----------------------------------------------------------------------

    const handleScroll = useCallback((event: any) => {
      const offsetY = event.nativeEvent.contentOffset.y;
      scrollOffsetY.current = offsetY;
      isAtTopOfScroll.current = offsetY <= 0;
    }, []);

    const handleContentSizeChange = useCallback(
      (_w: number, h: number) => {
        if (fitContent) {
          setMeasuredContentHeight(h);
        }
      },
      [fitContent],
    );

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------

    if (!shouldRender) return null;

    return (
      <Modal
        visible={shouldRender}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={closeSheet}
      >
        <View style={styles.overlay}>
          {/* Backdrop */}
          {showBackdrop && (
            <TouchableWithoutFeedback
              onPress={closeOnBackdropPress ? closeSheet : undefined}
            >
              <Animated.View
                style={[
                  styles.backdrop,
                  {
                    backgroundColor: backdropColor,
                    opacity: backdropAnim,
                  },
                ]}
              />
            </TouchableWithoutFeedback>
          )}

          {/* Sheet */}
          <Animated.View
            style={[
              styles.sheet,
              containerStyle,
              {
                transform: [
                  {
                    translateY: Animated.add(translateY, keyboardOffset),
                  },
                ],
              },
            ]}
            {...panResponder.panHandlers}
          >
            {/* Handle */}
            {showHandle && (
              <View style={styles.handleWrapper}>
                <View
                  style={[styles.handle, { backgroundColor: handleColor }]}
                />
              </View>
            )}

            {/* Content */}
            <ScrollView
              bounces={false}
              scrollEnabled={isScrollEnabled}
              onScroll={handleScroll}
              onContentSizeChange={handleContentSizeChange}
              scrollEventThrottle={16}
              showsVerticalScrollIndicator={true}
              contentContainerStyle={[styles.contentContainer, contentStyle]}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    );
  },
);

BottomSheet.displayName = 'BottomSheet';

export { BottomSheet };

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
    // Elevation for Android
    elevation: 24,
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
  },
  handleWrapper: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 6,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
  },
  contentContainer: {
    flexGrow: 1,
  },
});
