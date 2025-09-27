#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
工具模块

包含各种工具函数和配置管理
"""

from .config import get_settings, get_data_file_path

__all__ = [
    "get_settings",
    "get_data_file_path"
]