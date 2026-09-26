import { cssInterop } from 'nativewind';
import DraggableFlatList from 'react-native-draggable-flatlist';

// Resolve utilities for the library's outer gesture container and inner list.
cssInterop(DraggableFlatList, {
  className: 'containerStyle',
  contentContainerClassName: 'contentContainerStyle',
});

export { DraggableFlatList as DraggableRecordingList };
