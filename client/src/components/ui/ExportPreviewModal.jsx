import { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { createPortal } from 'react-dom';
import DownloadIcon from '@mui/icons-material/Download';
import CloseIcon from '@mui/icons-material/Close';
import CropFreeIcon from '@mui/icons-material/CropFree';
import SelectAllIcon from '@mui/icons-material/SelectAll';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import { EXPORT_MODES, COLORS, ZOOM } from '../../constants';

const ExportPreviewModal = ({
    isOpen,
    onClose,
    fullCanvasImage,
    canvasDimensions,
    objectsBounds,
    onDownload
}) => {
    const { t } = useTranslation(['toolbar', 'common']);
    const [exportMode, setExportMode] = useState(EXPORT_MODES.ALL_OBJECTS);
    const [customSelection, setCustomSelection] = useState(null);
    const [isSelecting, setIsSelecting] = useState(false);
    const [startPoint, setStartPoint] = useState(null);
    const [zoom, setZoom] = useState(0.5);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [lastPanPoint, setLastPanPoint] = useState(null);
    const containerRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            setExportMode(EXPORT_MODES.ALL_OBJECTS);
            setCustomSelection(null);
            setZoom(0.5);
            setPan({ x: 0, y: 0 });
        }
    }, [isOpen]);

    useEffect(() => {
        if (isOpen && objectsBounds && canvasDimensions) {
            const containerWidth = window.innerWidth * 0.95 - 32;
            const containerHeight = window.innerHeight * 0.95 - 200;

            const centerX = (objectsBounds.left + objectsBounds.width / 2) * zoom;
            const centerY = (objectsBounds.top + objectsBounds.height / 2) * zoom;

            setPan({
                x: containerWidth / 2 - centerX,
                y: containerHeight / 2 - centerY
            });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, objectsBounds, canvasDimensions]);

    const handleZoomIn = useCallback(() => {
        setZoom(z => Math.min(ZOOM.MAX, z + ZOOM.BUTTON_INCREMENT));
    }, []);

    const handleZoomOut = useCallback(() => {
        setZoom(z => Math.max(ZOOM.MIN, z - ZOOM.BUTTON_INCREMENT));
    }, []);

    const handleWheel = useCallback((e) => {
        e.preventDefault();

        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const multiplier = e.deltaY > 0 ? ZOOM.WHEEL_OUT_MULTIPLIER : ZOOM.WHEEL_IN_MULTIPLIER;

        setZoom(prevZoom => {
            const newZoom = Math.min(Math.max(prevZoom * multiplier, ZOOM.MIN), ZOOM.MAX);

            const worldX = (mouseX - pan.x) / prevZoom;
            const worldY = (mouseY - pan.y) / prevZoom;

            const newPanX = mouseX - worldX * newZoom;
            const newPanY = mouseY - worldY * newZoom;

            setPan({ x: newPanX, y: newPanY });

            return newZoom;
        });
    }, [pan]);

    const getDisplayBounds = useCallback(() => {
        if (!canvasDimensions) return null;

        if (exportMode === EXPORT_MODES.ALL_OBJECTS && objectsBounds) {
            return {
                left: objectsBounds.left * zoom + pan.x,
                top: objectsBounds.top * zoom + pan.y,
                width: objectsBounds.width * zoom,
                height: objectsBounds.height * zoom
            };
        }

        if (exportMode === EXPORT_MODES.CUSTOM_AREA && customSelection) {
            return customSelection;
        }

        return null;
    }, [exportMode, objectsBounds, customSelection, canvasDimensions, zoom, pan]);

    const handleMouseDown = useCallback((e) => {
        if (e.button === 1 || e.button === 2) {
            e.preventDefault();
            setIsPanning(true);
            setLastPanPoint({ x: e.clientX, y: e.clientY });
            return;
        }

        if (exportMode !== EXPORT_MODES.CUSTOM_AREA || e.button !== 0) return;

        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        setIsSelecting(true);
        setStartPoint({ x, y });
        setCustomSelection({ left: x, top: y, width: 0, height: 0 });
    }, [exportMode]);

    const handleMouseMove = useCallback((e) => {
        if (isPanning && lastPanPoint) {
            const deltaX = e.clientX - lastPanPoint.x;
            const deltaY = e.clientY - lastPanPoint.y;

            setPan(prev => ({
                x: prev.x + deltaX,
                y: prev.y + deltaY
            }));
            setLastPanPoint({ x: e.clientX, y: e.clientY });
            return;
        }

        if (!isSelecting || !startPoint) return;

        const rect = containerRef.current.getBoundingClientRect();
        const currentX = e.clientX - rect.left;
        const currentY = e.clientY - rect.top;

        const left = Math.min(startPoint.x, currentX);
        const top = Math.min(startPoint.y, currentY);
        const width = Math.abs(currentX - startPoint.x);
        const height = Math.abs(currentY - startPoint.y);

        setCustomSelection({ left, top, width, height });
    }, [isPanning, lastPanPoint, isSelecting, startPoint]);

    const handleMouseUp = useCallback(() => {
        if (isPanning) {
            setIsPanning(false);
            setLastPanPoint(null);
            return;
        }

        if (!isSelecting) return;
        setIsSelecting(false);

        if (customSelection && customSelection.width < 10) {
            setCustomSelection(null);
        }
    }, [isPanning, isSelecting, customSelection]);

    const handleContextMenu = useCallback((e) => {
        e.preventDefault();
    }, []);

    const cropAndDownload = useCallback(() => {
        if (!fullCanvasImage || !canvasDimensions) return;

        let cropBounds;

        if (exportMode === EXPORT_MODES.ALL_OBJECTS && objectsBounds) {
            cropBounds = objectsBounds;
        } else if (exportMode === EXPORT_MODES.CUSTOM_AREA && customSelection) {
            cropBounds = {
                left: (customSelection.left - pan.x) / zoom,
                top: (customSelection.top - pan.y) / zoom,
                width: customSelection.width / zoom,
                height: customSelection.height / zoom
            };
        }

        if (!cropBounds) {
            onDownload(fullCanvasImage);
            return;
        }

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = cropBounds.width;
            canvas.height = cropBounds.height;
            const ctx = canvas.getContext('2d');

            ctx.fillStyle = COLORS.BG_WHITEBOARD;
            ctx.fillRect(0, 0, cropBounds.width, cropBounds.height);
            ctx.drawImage(
                img,
                cropBounds.left, cropBounds.top, cropBounds.width, cropBounds.height,
                0, 0, cropBounds.width, cropBounds.height
            );

            onDownload(canvas.toDataURL('image/png'));
        };
        img.src = fullCanvasImage;
    }, [fullCanvasImage, exportMode, objectsBounds, customSelection, zoom, pan, canvasDimensions, onDownload]);

    const handleModeChange = useCallback((newMode) => {
        setExportMode(newMode);
        if (newMode === EXPORT_MODES.ALL_OBJECTS) {
            setCustomSelection(null);
        }
    }, []);

    if (!isOpen) return null;

    const displayBounds = getDisplayBounds();
    const showSelectionUI = exportMode === EXPORT_MODES.CUSTOM_AREA;
    const canDownload = exportMode === EXPORT_MODES.ALL_OBJECTS
        ? !!objectsBounds
        : (customSelection && customSelection.width > 10);

    const imageWidth = canvasDimensions ? canvasDimensions.width * zoom : 0;
    const imageHeight = canvasDimensions ? canvasDimensions.height * zoom : 0;

    return createPortal(
        <div className="modal-overlay">
            <div className="modal-content p-4 w-[95vw] h-[95vh] flex flex-col">
                <div className="flex justify-between items-center mb-3">
                    <h2 className="text-xl font-bold text-gray-800">{t('export.title')}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <CloseIcon />
                    </button>
                </div>

                <div className="flex justify-between items-center mb-3">
                    <div className="flex gap-4">
                        <label className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors ${
                            exportMode === EXPORT_MODES.ALL_OBJECTS
                                ? 'bg-blue-100 border-2 border-blue-500'
                                : 'bg-gray-100 border-2 border-transparent hover:bg-gray-200'
                        }`}>
                            <input
                                type="radio"
                                name="exportMode"
                                value={EXPORT_MODES.ALL_OBJECTS}
                                checked={exportMode === EXPORT_MODES.ALL_OBJECTS}
                                onChange={() => handleModeChange(EXPORT_MODES.ALL_OBJECTS)}
                                className="sr-only"
                            />
                            <SelectAllIcon className={exportMode === EXPORT_MODES.ALL_OBJECTS ? 'text-blue-600' : 'text-gray-600'} />
                            <span className={exportMode === EXPORT_MODES.ALL_OBJECTS ? 'text-blue-800 font-medium' : 'text-gray-700'}>
                                {t('export.allObjects')}
                            </span>
                        </label>

                        <label className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors ${
                            exportMode === EXPORT_MODES.CUSTOM_AREA
                                ? 'bg-blue-100 border-2 border-blue-500'
                                : 'bg-gray-100 border-2 border-transparent hover:bg-gray-200'
                        }`}>
                            <input
                                type="radio"
                                name="exportMode"
                                value={EXPORT_MODES.CUSTOM_AREA}
                                checked={exportMode === EXPORT_MODES.CUSTOM_AREA}
                                onChange={() => handleModeChange(EXPORT_MODES.CUSTOM_AREA)}
                                className="sr-only"
                            />
                            <CropFreeIcon className={exportMode === EXPORT_MODES.CUSTOM_AREA ? 'text-blue-600' : 'text-gray-600'} />
                            <span className={exportMode === EXPORT_MODES.CUSTOM_AREA ? 'text-blue-800 font-medium' : 'text-gray-700'}>
                                {t('export.customArea')}
                            </span>
                        </label>
                    </div>

                    <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-2 py-1">
                        <button
                            onClick={handleZoomOut}
                            disabled={zoom <= ZOOM.MIN}
                            className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={t('export.zoomOut')}
                        >
                            <RemoveIcon fontSize="small" />
                        </button>
                        <span className="text-sm font-medium w-14 text-center">
                            {Math.round(zoom * 100)}%
                        </span>
                        <button
                            onClick={handleZoomIn}
                            disabled={zoom >= ZOOM.MAX}
                            className="p-1 rounded hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={t('export.zoomIn')}
                        >
                            <AddIcon fontSize="small" />
                        </button>
                    </div>
                </div>

                <div
                    ref={containerRef}
                    className={`flex-1 bg-gray-200 border border-gray-300 rounded-lg overflow-hidden min-h-0 relative ${
                        isPanning ? 'cursor-grabbing' : showSelectionUI ? 'cursor-crosshair' : 'cursor-grab'
                    }`}
                    onWheel={handleWheel}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                    onContextMenu={handleContextMenu}
                >
                    {fullCanvasImage && canvasDimensions ? (
                        <>
                            <img
                                src={fullCanvasImage}
                                alt="Export Preview"
                                className="absolute select-none"
                                draggable={false}
                                style={{
                                    width: imageWidth,
                                    height: imageHeight,
                                    left: pan.x,
                                    top: pan.y,
                                }}
                            />
                            {displayBounds && displayBounds.width > 0 && (
                                <div
                                    className="absolute border-2 border-blue-500 bg-blue-500/20 pointer-events-none"
                                    style={{
                                        left: displayBounds.left,
                                        top: displayBounds.top,
                                        width: displayBounds.width,
                                        height: displayBounds.height,
                                    }}
                                />
                            )}
                        </>
                    ) : (
                        <div className="text-gray-500 flex justify-center items-center h-full">
                            {t('export.generatingPreview')}
                        </div>
                    )}
                </div>

                <div className="flex justify-between items-center mt-3">
                    <div className="text-sm text-gray-500">
                        {exportMode === EXPORT_MODES.ALL_OBJECTS && objectsBounds && (
                            <span>{t('export.allObjectsSelected')}</span>
                        )}
                        {exportMode === EXPORT_MODES.ALL_OBJECTS && !objectsBounds && (
                            <span className="text-amber-600">{t('export.noObjects')}</span>
                        )}
                        {showSelectionUI && customSelection && customSelection.width > 10 && (
                            <span>{t('export.customAreaSelected')}</span>
                        )}
                        {showSelectionUI && !customSelection && (
                            <span className="text-amber-600">{t('export.drawSelectionArea')}</span>
                        )}
                        <span className="ml-4 text-gray-400">{t('export.zoomPanHint')}</span>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-md text-gray-700 hover:bg-gray-100 transition-colors"
                        >
                            {t('common:buttons.cancel')}
                        </button>
                        <button
                            onClick={cropAndDownload}
                            disabled={!canDownload}
                            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
