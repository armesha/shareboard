import { useState, useCallback } from 'react';
import { fabric } from 'fabric';
import { v4 as uuidv4 } from 'uuid';
import { TOOLS, CANVAS } from '../constants';

export function useTextEditing({ canvas, color, addElement, setTool }) {
  const [isTextModalOpen, setIsTextModalOpen] = useState(false);
  const [editingText, setEditingText] = useState(null);
  const [clickPosition, setClickPosition] = useState(null);

  const openTextModal = useCallback((position) => {
    setClickPosition(position);
    setIsTextModalOpen(true);
  }, []);

  const openTextEditModal = useCallback((textObj) => {
    setEditingText({
      id: textObj.id,
      text: textObj.text || '',
      left: textObj.left,
      top: textObj.top,
      fontSize: textObj.fontSize,
      fill: textObj.fill,
      angle: textObj.angle,
      scaleX: textObj.scaleX,
      scaleY: textObj.scaleY
    });
    setIsTextModalOpen(true);
  }, []);

  const closeTextModal = useCallback(() => {
    setIsTextModalOpen(false);
    setClickPosition(null);
    setEditingText(null);
  }, []);

  const handleTextSubmit = useCallback((text) => {
    if (!canvas) return;

    if (editingText) {
      const obj = canvas.getObjects().find(o => o.id === editingText.id);
      if (obj) {
        obj.set('text', text);
        canvas.requestRenderAll();

        addElement({
          id: editingText.id,
          type: 'text',
          data: {
            ...editingText,
            text: text
          }
        });
      }
      setEditingText(null);
    } else if (clickPosition) {
      const textId = uuidv4();
      const textObj = new fabric.Text(text, {
        left: clickPosition.x,
        top: clickPosition.y,
        fontSize: CANVAS.DEFAULT_FONT_SIZE,
        fill: color,
        id: textId,
        selectable: true,
        hasControls: true,
        hasBorders: true
      });

      canvas.add(textObj);
      canvas.setActiveObject(textObj);
      canvas.requestRenderAll();

      addElement({
        id: textId,
        type: 'text',
        data: {
          text: text,
          left: clickPosition.x,
          top: clickPosition.y,
          fontSize: CANVAS.DEFAULT_FONT_SIZE,
          fill: color,
          selectable: true,
          hasControls: true,
          hasBorders: true
        }
      });
    }

    setIsTextModalOpen(false);
    setClickPosition(null);
    setTool(TOOLS.SELECT);
  }, [canvas, color, addElement, setTool, editingText, clickPosition]);

  const handleDoubleClickText = useCallback((e, tool) => {
    if (!canvas || tool !== TOOLS.SELECT) return;

    const pointer = canvas.getPointer(e.e);
    const objects = canvas.getObjects();

    for (let i = objects.length - 1; i >= 0; i--) {
      const obj = objects[i];
      if (obj.type === 'text' && obj.containsPoint(pointer)) {
        openTextEditModal(obj);
        return true;
      }
    }
    return false;
  }, [canvas, openTextEditModal]);

  return {
    isTextModalOpen,
    editingText,
    clickPosition,
    openTextModal,
    openTextEditModal,
    closeTextModal,
    handleTextSubmit,
    handleDoubleClickText
  };
}
