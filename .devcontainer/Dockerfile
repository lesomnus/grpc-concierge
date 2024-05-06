FROM ghcr.io/lesomnus/dev-node:20

RUN --mount=type=cache,target=/var/cache/apt,sharing=locked \
	--mount=type=cache,target=/var/lib/apt,sharing=locked \
	apt update \
	&& apt-get install --no-install-recommends --yes \
		clang-format

RUN TMP_DIR=$(mktemp -d) \
	&& cd $TMP_DIR \
	&& curl -o a.tar.gz -L "https://github.com/yoheimuta/protolint/releases/download/v0.47.5/protolint_0.47.5_linux_$(dpkg --print-architecture).tar.gz" \
	&& tar -xf a.tar.gz \
	&& mv protolint /usr/local/bin/. \
	&& rm -rf $TMP_DIR



USER hypnos

# Comment below lines if you don't want to use Zsh
RUN wget https://github.com/robbyrussell/oh-my-zsh/raw/master/tools/install.sh -O - | zsh || true \
	&& git clone https://github.com/zsh-users/zsh-autosuggestions         ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-autosuggestions     \
	&& git clone https://github.com/zsh-users/zsh-syntax-highlighting.git ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-syntax-highlighting \
	&& git clone https://github.com/zsh-users/zsh-completions             ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/zsh-completions         \
	&& git clone https://github.com/supercrabtree/k                       ${ZSH_CUSTOM:-~/.oh-my-zsh/custom}/plugins/k
ADD .zshrc /home/hypnos
ENV SHELL /bin/zsh
