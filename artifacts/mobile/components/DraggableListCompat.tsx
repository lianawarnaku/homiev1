import React from "react";
import {
  FlatList,
  type FlatListProps,
  Platform,
  ScrollView,
  type ScrollViewProps,
} from "react-native";
import {
  NestableDraggableFlatList,
  NestableScrollContainer,
  ScaleDecorator,
  type RenderItemParams,
} from "react-native-draggable-flatlist";

type DraggableListCompatProps<T> = Omit<FlatListProps<T>, "data" | "keyExtractor" | "renderItem"> & {
  data: T[];
  keyExtractor: (item: T, index: number) => string;
  renderItem: (params: RenderItemParams<T>) => React.ReactElement | null;
  onDragEnd?: (params: { data: T[]; from: number; to: number }) => void;
  activationDistance?: number;
};

export function DraggableListCompat<T>({
  renderItem,
  data,
  keyExtractor,
  onDragEnd,
  activationDistance,
  ...props
}: DraggableListCompatProps<T>) {
  if (Platform.OS === "web") {
    return (
      <FlatList
        {...props}
        data={data}
        keyExtractor={keyExtractor}
        scrollEnabled={false}
        renderItem={({ item, index }) =>
          renderItem({
            item,
            drag: () => undefined,
            isActive: false,
            getIndex: () => index,
          })
        }
      />
    );
  }

  return (
    <NestableDraggableFlatList
      {...props}
      data={data}
      keyExtractor={keyExtractor}
      renderItem={renderItem}
      onDragEnd={onDragEnd}
      activationDistance={activationDistance}
    />
  );
}

export function DraggableScrollContainerCompat(props: ScrollViewProps) {
  if (Platform.OS === "web") {
    return <ScrollView {...props} />;
  }
  return <NestableScrollContainer {...props} />;
}

export function ScaleDecoratorCompat({ children }: { children: React.ReactNode }) {
  if (Platform.OS === "web") return <>{children}</>;
  return <ScaleDecorator>{children}</ScaleDecorator>;
}
