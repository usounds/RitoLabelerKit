import { create } from 'zustand'
import { BlueRitoLabelAutoLikeSettings, BlueRitoLabelAutoLike, BlueRitoLabelAutoPost } from '@/lexicons/index';
import { AppBskyLabelerService, } from '@atcute/bluesky';

export type BlueRitoLabelAutoLikeWithRkey = BlueRitoLabelAutoLike.Main & {
  rkey: string; // 追加するフィールド
};

export type BlueRitoLabelAutoPostWithRkey = BlueRitoLabelAutoPost.Main & {
  rkey: string; // 追加するフィールド
};

export type AppBskyLabelerServiceExtend = AppBskyLabelerService.Main & {
  rkey: string; // 追加するフィールド
};

type ManageStore = {
  labelerDef: AppBskyLabelerService.Main | null
  likeSettings: BlueRitoLabelAutoLikeSettings.Main | null
  like: BlueRitoLabelAutoLikeWithRkey[]
  post: BlueRitoLabelAutoPostWithRkey[]
  useLike: boolean
  labelerVersion: string
  autoLabelingVersion: string
  autoLabelingJetstreamCursor: Date | null
  autoLabelingQueueCursor: Date | null
  serviceEndpoint: string
  isAutoLabelingAvailable: boolean

  setLabelerDef: (v: AppBskyLabelerService.Main | null) => void
  setLikeSettings: (v: BlueRitoLabelAutoLikeSettings.Main | null) => void
  setLike: (v: BlueRitoLabelAutoLikeWithRkey[]) => void
  setPost: (v: BlueRitoLabelAutoPostWithRkey[]) => void
  setUseLike: (v: boolean) => void
  setLabelerVersion: (v: string) => void
  setAutoLabelingVersion: (v: string) => void
  setAutoLabelingJetstreamCursor: (v: Date) => void
  setAutoLabelingQueueCursor: (v: Date) => void
  setServiceEndpoint: (v: string) => void
  setIsAutoLabelingAvailable: (v: boolean) => void
}

export const useManageStore = create<ManageStore>((set) => ({
  labelerDef: null,
  likeSettings: null,
  like: [],
  post: [],
  useLike: false,
  labelerVersion: '',
  autoLabelingVersion: '',
  autoLabelingJetstreamCursor: null,
  autoLabelingQueueCursor: null,
  serviceEndpoint: "",
  isAutoLabelingAvailable: false,

  setLabelerDef: (labelerDef) => set({ labelerDef }),
  setLikeSettings: (likeSettings) => set({ likeSettings }),
  setLike: (like) => set({ like }),
  setUseLike: (useLike) => set({ useLike }),
  setPost: (post) => set({ post }),
  setLabelerVersion: (labelerVersion) => set({ labelerVersion }),
  setAutoLabelingVersion: (autoLabelingVersion) => set({ autoLabelingVersion }),
  setAutoLabelingJetstreamCursor: (autoLabelingJetstreamCursor) => set({ autoLabelingJetstreamCursor: autoLabelingJetstreamCursor }),
  setAutoLabelingQueueCursor: (autoLabelingQueueCursor) => set({ autoLabelingQueueCursor: autoLabelingQueueCursor }),
  setServiceEndpoint: (serviceEndpoint) => set({ serviceEndpoint }),
  setIsAutoLabelingAvailable: (isAutoLabelingAvailable) => set({ isAutoLabelingAvailable }),
}))
