# react-native-pure-bottom-sheet

A lightweight, zero-dependency, performant drag-to-dismiss bottom sheet for React Native and Expo. 

It is built purely on the built-in React Native `Animated` API and `PanResponder`, meaning **no external gesture handler or animation libraries (like `react-native-reanimated` or `react-native-gesture-handler`) are required.**

---

## Features

- 🚀 **Zero Dependencies**: Keeps your bundle size small and avoids native dependency conflicts.
- 📱 **Expo Compatible**: Works out-of-the-box in Expo Go and bare React Native apps.
- 📐 **Dynamic Sizing (`fitContent`)**: Automatically measures and snaps to fit its children content.
- 🎯 **Snap Points**: Supports multiple snap points expressed as fractions of screen height (e.g. `[0.3, 0.6, 0.9]`).
- ⌨️ **Keyboard Avoidance**: Automatically moves up when the keyboard appears.
- 📜 **Built-in ScrollView Integration**: Seamless scrolling inside the sheet; drags down to dismiss only when scrolled to the top.
- 🎨 **Fully Customizable**: Backdrop opacity/color, handle styles, container styling, and spring animations can all be adjusted.

---

## Installation

Install the package via npm or yarn:

```bash
npm install react-native-pure-bottom-sheet
```

or

```bash
yarn add react-native-pure-bottom-sheet
```

---

## Usage

### 1. Basic Example

```tsx
import React, { useState } from 'react';
import { StyleSheet, Text, View, Button } from 'react-native';
import { BottomSheet } from 'react-native-pure-bottom-sheet';

export default function App() {
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.container}>
      <Button title="Open Bottom Sheet" onPress={() => setVisible(true)} />

      <BottomSheet visible={visible} onClose={() => setVisible(false)}>
        <View style={styles.content}>
          <Text style={styles.title}>Hello from Bottom Sheet!</Text>
          <Text style={styles.text}>Drag me down to dismiss or tap the backdrop.</Text>
        </View>
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  text: {
    fontSize: 16,
    color: '#666',
  },
});
```

### 2. Custom Snap Points

You can define multiple snap points as fractions of the screen height. For example, `[0.3, 0.6, 0.9]` represents 30%, 60%, and 90% of the screen height.

```tsx
<BottomSheet
  visible={visible}
  onClose={() => setVisible(false)}
  snapPoints={[0.3, 0.6, 0.9]}
  initialSnapIndex={1} // Opens at 60% height
>
  <View style={{ padding: 20 }}>
    <Text>Scrollable or drag-to-snap content...</Text>
  </View>
</BottomSheet>
```

### 3. Dynamic Auto-Sizing (`fitContent`)

If you don't know the content height beforehand and want the sheet to auto-fit to its children, set `fitContent` to `true`.

```tsx
<BottomSheet
  visible={visible}
  onClose={() => setVisible(false)}
  fitContent={true}
>
  <View style={{ padding: 24 }}>
    <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Dynamic Content</Text>
    <Text>This sheet will size itself perfectly to match this content!</Text>
  </View>
</BottomSheet>
```

### 4. Programmatic Control (Imperative Ref)

You can use a React ref to programmatically control the bottom sheet's snapping position or close it.

```tsx
import React, { useRef, useState } from 'react';
import { View, Button } from 'react-native';
import { BottomSheet, BottomSheetRef } from 'react-native-pure-bottom-sheet';

export default function App() {
  const [visible, setVisible] = useState(false);
  const sheetRef = useRef<BottomSheetRef>(null);

  return (
    <View style={{ flex: 1, justifyContent: 'center' }}>
      <Button title="Open Sheet" onPress={() => setVisible(true)} />

      <BottomSheet
        ref={sheetRef}
        visible={visible}
        onClose={() => setVisible(false)}
        snapPoints={[0.4, 0.8]}
      >
        <View style={{ padding: 20 }}>
          <Button title="Snap to Top (80%)" onPress={() => sheetRef.current?.snapTo(1)} />
          <Button title="Close Programmatically" onPress={() => sheetRef.current?.close()} />
        </View>
      </BottomSheet>
    </View>
  );
}
```

---

## Props

| Prop | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `visible` | `boolean` | *Required* | Controls the visibility of the bottom sheet. |
| `onClose` | `() => void` | *Required* | Callback function triggered when the sheet requests to close (backdrop tap or dragged down). |
| `snapPoints` | `SnapPoint[]` | `[0.5]` | Ordered array of snap points expressed as fractions of screen height (e.g. `[0.3, 0.6, 0.9]`). |
| `initialSnapIndex` | `number` | `0` | The index of the snap point the bottom sheet starts at when opened. |
| `enableDragToClose` | `boolean` | `true` | Enables/disables dragging below the lowest snap point to close the sheet. |
| `closeThreshold` | `number` | `0.35` | Threshold (fraction of lowest snap height) below which the sheet auto-closes. |
| `showBackdrop` | `boolean` | `true` | Render a translucent overlay backdrop behind the sheet. |
| `backdropColor` | `string` | `'#000000'` | Background color of the backdrop. |
| `backdropOpacity` | `number` | `0.5` | Maximum opacity value for the backdrop (from 0 to 1). |
| `closeOnBackdropPress` | `boolean` | `true` | Closes the bottom sheet when the backdrop is pressed. |
| `showHandle` | `boolean` | `true` | Shows the grab handle indicator at the top center of the sheet. |
| `handleColor` | `string` | `'#C4C4C4'` | Color of the grab handle indicator. |
| `containerStyle` | `StyleProp<ViewStyle>` | `undefined` | Custom styling for the bottom sheet container wrapper. |
| `contentStyle` | `StyleProp<ViewStyle>` | `undefined` | Custom styling for the ScrollView content container. |
| `springConfig` | `{ tension?, friction? }` | `{ tension: 170, friction: 26 }` | Spring animation properties for snap transitions. |
| `avoidKeyboard` | `boolean` | `true` | Automatically slides the sheet up to prevent inputs from being covered by the keyboard. |
| `fitContent` | `boolean` | `false` | Dynamically measures the children height and sets the snap point to match it. |
| `onSnap` | `(index: number) => void` | `undefined` | Callback function triggered when the sheet successfully snaps to a point. |

---

## Methods (via `ref`)

Expose these methods by assigning a ref of type `BottomSheetRef` to the `<BottomSheet>` component:

- **`snapTo(index: number)`**: Programmatically animates the bottom sheet to the specified snap point index.
- **`close()`**: Programmatically triggers the close animation and invokes `onClose`.

---

## License

This project is licensed under the MIT License.