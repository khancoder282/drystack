import { useRef, useState } from 'react';
import { Button, ButtonGroup, ToggleButton } from '@keystar/ui/button';
import { Dialog, useDialogContainer } from '@keystar/ui/dialog';
import { Content } from '@keystar/ui/slots';
import { Flex } from '@keystar/ui/layout';
import { Heading, Text } from '@keystar/ui/typography';
import { Notice } from '@keystar/ui/notice';

const DISPLAY_SIZE = 480;

type Rect = { x: number; y: number; w: number; h: number };

function isCompressible(filename: string) {
  return /\.(jpe?g|webp)$/i.test(filename);
}

export function AssetPreviewDialog(props: {
  filename: string;
  objectUrl: string;
  onSave: (content: Uint8Array) => Promise<void>;
}) {
  const { dismiss } = useDialogContainer();
  const [zoom, setZoom] = useState(1);
  const [mode, setMode] = useState<'view' | 'crop'>('view');
  const [natural, setNatural] = useState({ width: 0, height: 0 });
  const [cropRect, setCropRect] = useState<Rect | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null
  );
  const [quality, setQuality] = useState(0.8);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imgWrapRef = useRef<HTMLDivElement | null>(null);

  const displayScale =
    natural.width > 0 ? Math.min(1, DISPLAY_SIZE / natural.width) : 1;
  const displayWidth = natural.width * displayScale;
  const displayHeight = natural.height * displayScale;

  function pointerToDisplayCoords(event: { clientX: number; clientY: number }) {
    const rect = imgWrapRef.current!.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  async function withCanvas(
    draw: (ctx: CanvasRenderingContext2D, img: HTMLImageElement) => void,
    size: { width: number; height: number },
    mimeType: string,
    canvasQuality?: number
  ): Promise<Uint8Array> {
    const img = new Image();
    img.src = props.objectUrl;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext('2d')!;
    draw(ctx, img);
    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        b => (b ? resolve(b) : reject(new Error('Failed to encode image'))),
        mimeType,
        canvasQuality
      );
    });
    return new Uint8Array(await blob.arrayBuffer());
  }

  async function applyCrop() {
    if (!cropRect) return;
    setIsSaving(true);
    setError(null);
    try {
      const sx = cropRect.x / displayScale;
      const sy = cropRect.y / displayScale;
      const sw = cropRect.w / displayScale;
      const sh = cropRect.h / displayScale;
      const content = await withCanvas(
        (ctx, img) => ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh),
        { width: sw, height: sh },
        isCompressible(props.filename) ? 'image/jpeg' : 'image/png'
      );
      await props.onSave(content);
      dismiss();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  }

  async function applyCompression() {
    setIsSaving(true);
    setError(null);
    try {
      const content = await withCanvas(
        (ctx, img) => ctx.drawImage(img, 0, 0),
        { width: natural.width, height: natural.height },
        'image/jpeg',
        quality
      );
      await props.onSave(content);
      dismiss();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog size="large" onDismiss={dismiss}>
      <Heading>{props.filename}</Heading>
      <Content>
        <Flex direction="column" gap="large">
          {error && <Notice tone="critical">{error}</Notice>}
          <Flex gap="regular" alignItems="center">
            <ToggleButton
              isSelected={mode === 'view'}
              onPress={() => setMode('view')}
            >
              View
            </ToggleButton>
            <ToggleButton
              isSelected={mode === 'crop'}
              onPress={() => {
                setMode('crop');
                setCropRect(null);
              }}
            >
              Crop
            </ToggleButton>
            {mode === 'view' && (
              <Flex gap="small" alignItems="center">
                <Text size="small">Zoom</Text>
                <input
                  type="range"
                  min={0.25}
                  max={3}
                  step={0.05}
                  value={zoom}
                  onChange={e => setZoom(Number(e.target.value))}
                />
                <Text size="small">{Math.round(zoom * 100)}%</Text>
              </Flex>
            )}
          </Flex>

          <Flex
            justifyContent="center"
            UNSAFE_style={{
              overflow: 'auto',
              maxHeight: '55vh',
              padding: 16,
            }}
          >
            <div
              ref={imgWrapRef}
              style={{
                position: 'relative',
                width: mode === 'crop' ? displayWidth : undefined,
                height: mode === 'crop' ? displayHeight : undefined,
                lineHeight: 0,
                touchAction: 'none',
              }}
              onPointerDown={event => {
                if (mode !== 'crop') return;
                const point = pointerToDisplayCoords(event);
                setDragStart(point);
                setCropRect({ x: point.x, y: point.y, w: 0, h: 0 });
              }}
              onPointerMove={event => {
                if (mode !== 'crop' || !dragStart) return;
                const point = pointerToDisplayCoords(event);
                setCropRect({
                  x: Math.min(dragStart.x, point.x),
                  y: Math.min(dragStart.y, point.y),
                  w: Math.abs(point.x - dragStart.x),
                  h: Math.abs(point.y - dragStart.y),
                });
              }}
              onPointerUp={() => setDragStart(null)}
            >
              <img
                src={props.objectUrl}
                alt=""
                draggable={false}
                onLoad={event => {
                  const img = event.currentTarget;
                  setNatural({
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                  });
                }}
                style={{
                  display: 'block',
                  width: mode === 'crop' ? displayWidth : undefined,
                  height: mode === 'crop' ? displayHeight : undefined,
                  maxWidth: mode === 'view' ? '100%' : undefined,
                  transform: mode === 'view' ? `scale(${zoom})` : undefined,
                  transformOrigin: 'center',
                }}
              />
              {mode === 'crop' && cropRect && (
                <div
                  style={{
                    position: 'absolute',
                    left: cropRect.x,
                    top: cropRect.y,
                    width: cropRect.w,
                    height: cropRect.h,
                    border: '2px dashed white',
                    boxShadow: '0 0 0 9999px rgba(0,0,0,0.4)',
                    pointerEvents: 'none',
                  }}
                />
              )}
            </div>
          </Flex>

          {mode === 'crop' && (
            <Text size="small" color="neutralTertiary">
              Drag on the image to select a crop area, then apply.
            </Text>
          )}

          <Flex gap="regular" alignItems="center">
            <Text size="small">Compress quality</Text>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={quality}
              onChange={e => setQuality(Number(e.target.value))}
              disabled={!isCompressible(props.filename)}
            />
            <Text size="small">{Math.round(quality * 100)}%</Text>
            <Button
              isDisabled={isSaving || !isCompressible(props.filename)}
              onPress={applyCompression}
            >
              Compress &amp; save
            </Button>
          </Flex>
        </Flex>
      </Content>
      <ButtonGroup>
        <Button onPress={dismiss}>Close</Button>
        {mode === 'crop' && (
          <Button
            prominence="high"
            isDisabled={isSaving || !cropRect || cropRect.w < 4 || cropRect.h < 4}
            onPress={applyCrop}
          >
            Apply crop &amp; save
          </Button>
        )}
      </ButtonGroup>
    </Dialog>
  );
}
