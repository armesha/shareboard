import { useState, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import DownloadIcon from '@mui/icons-material/Download';
import CloseIcon from '@mui/icons-material/Close';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import ClearIcon from '@mui/icons-material/Clear';
import { COLORS } from '../../constants';

const ExportPreviewModal = ({
    isOpen,
    onClose,
    fullCanvasImage,
    canvasDimensions,
    objectsBounds,
    onDownload
}) => {
    const { t } = useTranslation(['toolbar', 'common']);
    const [selection, setSelection] = useState(null);
    const [isSelecting, setIsSelecting] = useState(false);
    const [startPoint, setStartPoint] = useState(null);
    const containerRef = useRef(null);
    const imgRef = useRef(null);

    const handleSelectAll = useCallback(() => {
        if (!objectsBounds || !imgRef.current) return;
        const img = imgRef.current;
        const scaleX = img.clientWidth / canvasDimensions.width;
        const scaleY = img.clientHeight / canvasDimensions.height;

        setSelection({
            left: objectsBounds.left * scaleX,
            top: objectsBounds.top * scaleY,
            width: objectsBounds.width * scaleX,
            height: objectsBounds.height * scaleY
        });
    }, [objectsBounds, canvasDimensions]);

    const handleClearSelection = useCallback(() => {
        setSelection(null);
    }, []);

    const handleMouseDown = useCallback((e) => {
        if (e.button !== 0) return;
        const rect = imgRef.current?.getBoundingClientRect();
        if (!rect) return;

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;

        setIsSelecting(true);
        setStartPoint({ x, y });
        setSelection({ left: x, top: y, width: 0, height: 0 });
    }, []);

    const handleMouseMove = useCallback((e) => {
        if (!isSelecting || !startPoint || !imgRef.current) return;

        const rect = imgRef.current.getBoundingClientRect();
        const currentX = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const currentY = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

        setSelection({
            left: Math.min(startPoint.x, currentX),
            top: Math.min(startPoint.y, currentY),
            width: Math.abs(currentX - startPoint.x),
            height: Math.abs(currentY - startPoint.y)
        });
    }, [isSelecting, startPoint]);

    const handleMouseUp = useCallback(() => {
        if (!isSelecting) return;
        setIsSelecting(false);
        if (selection && selection.width < 10) {
            setSelection(null);
        }
    }, [isSelecting, selection]);

    const handleDownload = useCallback(() => {
        if (!fullCanvasImage || !canvasDimensions) return;

        if (!selection || selection.width < 10 || !imgRef.current) {
            onDownload(fullCanvasImage);
            return;
        }

        const img = imgRef.current;
        const scaleX = canvasDimensions.width / img.clientWidth;
        const scaleY = canvasDimensions.height / img.clientHeight;

        const cropBounds = {
            left: selection.left * scaleX,
            top: selection.top * scaleY,
            width: selection.width * scaleX,
            height: selection.height * scaleY
        };

        const image = new Image();
        image.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = cropBounds.width;
            canvas.height = cropBounds.height;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = COLORS.BG_WHITEBOARD;
            ctx.fillRect(0, 0, cropBounds.width, cropBounds.height);
            ctx.drawImage(
                image,
                cropBounds.left, cropBounds.top, cropBounds.width, cropBounds.height,
                0, 0, cropBounds.width, cropBounds.height
            );

            onDownload(canvas.toDataURL('image/png'));
        };
        image.src = fullCanvasImage;
    }, [fullCanvasImage, canvasDimensions, selection, onDownload]);

    if (!isOpen) return null;

    const hasSelection = selection && selection.width > 10;

    return createPortal(
        <div className="modal-overlay">
            <div className="modal-content p-4 flex flex-col" style={{ maxWidth: '90vw', maxHeight: '90vh' }}>
                <div className="flex justify-between items-center mb-3">
                    <h2 className="text-xl font-bold text-gray-800">{t('export.title')}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <CloseIcon />
                    </button>
                </div>

                <div className="flex gap-2 mb-3">
                    <button
                        onClick={handleSelectAll}
                        disabled={!objectsBounds}
                        className="flex items-center gap-2 px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <SelectAllIcon fontSize="small" />
                        {t('export.selectAll')}
                    </button>
                    {hasSelection && (
                        <button
                            onClick={handleClearSelection}
                            className="flex items-center gap-2 px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                        >
                            <ClearIcon fontSize="small" />
                            {t('export.clearSelection')}
                        </button>
                    )}
                </div>

                <div
                    ref={containerRef}
                    className="relative inline-block cursor-crosshair"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    {fullCanvasImage ? (
                        <>
                            <img
                                ref={imgRef}
                                src={fullCanvasImage}
                                alt="Export Preview"
                                className="max-w-full max-h-[60vh] select-none border border-gray-300 rounded"
                                draggable={false}
                            />
                            {hasSelection && (
                                <div
                                    className="absolute border-2 border-blue-500 bg-blue-500/20 pointer-events-none"
                                    style={{
                                        left: selection.left,
                                        top: selection.top,
                                        width: selection.width,
                                        height: selection.height,
                                    }}
                                />
                            )}
                        </>
                    ) : (
                        <div className="text-gray-500 p-8">
                            {t('export.generatingPreview')}
                        </div>
                    )}
                </div>

                <div className="flex justify-between items-center mt-3">
                    <div className="text-sm text-gray-500">
                        {hasSelection ? t('export.customAreaSelected') : t('export.drawOrSelectAll')}
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                            {t('common:buttons.cancel')}
                        </button>
                        <button
                            onClick={handleDownload}
                            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center gap-2"
                        >
                            <DownloadIcon fontSize="small" />
                            {t('export.downloadImage')}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ExportPreviewModal;
