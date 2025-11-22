// syugeeeeeeeeeei/raidchain-webui/Raidchain-WebUI-temp-refact/src/hooks/useResizerPanel.ts

import { useState, useEffect, useRef } from 'react';

/**
 * リサイズ可能なパネルの制御Hook
 * * 【パフォーマンス & UX改善版】
 * 1. DOM直接操作による再レンダリング回避（ラグ排除）
 * 2. ドラッグ中のCSS transition無効化（追従性向上）
 */
export const useResizerPanel = (
	initialHeight: number = 320,
	minHeight: number = 100,
	maxHeightRatio: number = 0.8
) => {
	const [isOpen, setIsOpen] = useState(false);
	const [height, setHeight] = useState(initialHeight);

	const panelRef = useRef<HTMLDivElement>(null);
	const resizerRef = useRef<HTMLDivElement>(null);
	const isDragging = useRef(false);

	useEffect(() => {
		const resizer = resizerRef.current;
		if (!resizer) return;

		const handleMouseDown = (e: MouseEvent) => {
			e.preventDefault();
			isDragging.current = true;

			// 【重要】ドラッグ開始時にtransition（アニメーション）を無効化する
			// これにより、マウスの動きに対して遅延なく追従するようになる
			if (panelRef.current) {
				panelRef.current.style.transition = 'none';
			}

			document.addEventListener('mousemove', handleMouseMove);
			document.addEventListener('mouseup', handleMouseUp);
			document.body.style.cursor = 'row-resize';
			document.body.style.userSelect = 'none';
		};

		const handleMouseMove = (e: MouseEvent) => {
			if (!isDragging.current || !panelRef.current) return;

			const newHeight = window.innerHeight - e.clientY;
			const maxHeight = window.innerHeight * maxHeightRatio;

			if (newHeight > 80 && newHeight < maxHeight) {
				panelRef.current.style.height = `${newHeight}px`;
			}
		};

		const handleMouseUp = () => {
			isDragging.current = false;
			document.removeEventListener('mousemove', handleMouseMove);
			document.removeEventListener('mouseup', handleMouseUp);
			document.body.style.cursor = '';
			document.body.style.userSelect = '';

			if (panelRef.current) {
				// 【重要】ドラッグ終了時にtransition設定を削除（元に戻す）
				// これにより、開閉ボタン操作時のアニメーションは維持される
				panelRef.current.style.transition = '';

				const currentHeight = panelRef.current.clientHeight;

				if (currentHeight < 120) {
					setIsOpen(false);
					setHeight(initialHeight);
					panelRef.current.style.removeProperty('height');
				} else {
					setHeight(currentHeight);
					if (!isOpen) setIsOpen(true);
				}
			}
		};

		resizer.addEventListener('mousedown', handleMouseDown);
		return () => {
			resizer.removeEventListener('mousedown', handleMouseDown);
			document.removeEventListener('mousemove', handleMouseMove);
			document.removeEventListener('mouseup', handleMouseUp);
		};
	}, [isOpen, minHeight, maxHeightRatio, initialHeight]);

	return { isOpen, setIsOpen, height, panelRef, resizerRef };
};